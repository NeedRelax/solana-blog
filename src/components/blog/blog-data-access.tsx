'use client';

import { getBlogProgram, getBlogProgramId } from '@project/anchor'; // 假设你的 anchor 工具函数叫这个名字
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Cluster, PublicKey } from '@solana/web3.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useCluster } from '../cluster/cluster-data-access';
import { useAnchorProvider } from '../solana/solana-provider';
import { useTransactionToast } from '../use-transaction-toast';
import { toast } from 'sonner';
import { BN } from '@coral-xyz/anchor'; // 导入 BN


export function useBlogProgram() {
  const { connection } = useConnection();
  const { cluster } = useCluster();
  const transactionToast = useTransactionToast();
  const provider = useAnchorProvider();
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();

  // 获取程序 ID 和程序实例
  const programId = useMemo(() => getBlogProgramId(cluster.network as Cluster), [cluster]);
  const program = useMemo(() => getBlogProgram(provider, programId), [provider, programId]);

  // 查询：获取所有帖子账户
  const postsQuery = useQuery({
    queryKey: ['blog', 'all', { cluster }],
    queryFn: async () => {
      const posts = await program.account.post.all();
      // 按时间戳降序排序
      posts.sort((a, b) =>
      {
        const timeA = a.account.timestamp as BN;
        const timeB = b.account.timestamp as BN;
        return timeB.cmp(timeA);
      });
      return posts;
    },
  });

  // 查询：获取程序账户信息，用于检查程序是否部署
  const getProgramAccount = useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  });

  // 变更：创建一篇新帖子
  const createPostMutation = useMutation({
    mutationKey: ['blog', 'create', { cluster, publicKey }],
    mutationFn: async ({ title, content, slug }: { title: string, content: string, slug: string }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected!");
      }
      // 在客户端派生 PDA
      const [postPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("post"), publicKey.toBuffer(), Buffer.from(slug)],
        program.programId
      );

      const signature = await program.methods
        .createPost(title, content, slug)
        .accounts({
          postAccount: postPda,
          author: publicKey,
        })
        .rpc();
      return signature;
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      // 成功后，让所有帖子的查询失效，从而触发重新获取
      return queryClient.invalidateQueries({ queryKey: ['blog', 'all'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create post: ${error.message}`);
    },
  });

  return {
    program,
    programId,
    postsQuery,
    getProgramAccount,
    createPostMutation,
  };
}


/**
 * Hook，用于与单个帖子账户交互
 */
export function useBlogPostProgramAccount({ account: postPublicKey }: { account: PublicKey }) {
  const { cluster } = useCluster();
  const transactionToast = useTransactionToast();
  const { program } = useBlogProgram();
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();

  // 查询：获取单个帖子的详细信息
  const postQuery = useQuery({
    queryKey: ['blog', 'fetch', { cluster, postPublicKey }],
    queryFn: () => program.account.post.fetch(postPublicKey),
  });

  // 变更：更新帖子
  const updatePostMutation = useMutation({
    mutationKey: ['blog', 'update', { cluster, postPublicKey, publicKey }],
    mutationFn: async ({ title, content }: { title: string; content: string }) => {
      return program.methods
        .editPost(title, content)
        .accounts({
          postAccount: postPublicKey,
        })
        .rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      // 同时让列表和单个帖子的查询失效
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ['blog', 'all'] }),
        queryClient.invalidateQueries({ queryKey: ['blog', 'fetch', { postPublicKey }] })
      ]);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update post: ${error.message}`);
    },
  });

  // 变更：删除帖子
  const deletePostMutation = useMutation({
    mutationKey: ['blog', 'delete', { cluster, postPublicKey, publicKey }],
    mutationFn: () => {
      return program.methods
        .deletePost()
        .accounts({
          postAccount: postPublicKey,
        })
        .rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      // 只需要让列表查询失效即可
      return queryClient.invalidateQueries({ queryKey: ['blog', 'all'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete post: ${error.message}`);
    }
  });

  return {
    postQuery,
    updatePostMutation,
    deletePostMutation,
  };
}