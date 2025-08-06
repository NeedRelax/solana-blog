'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletButton } from '../solana/solana-provider';
import { ExplorerLink } from '../cluster/cluster-ui';
import { useBlogProgram } from './blog-data-access';
import { PostCreate, PostList } from './blog-ui';
import { AppHero } from '../app-hero';
import { ellipsify } from '@/lib/utils';

export default function BlogFeature() {
  const { publicKey } = useWallet();
  const { programId } = useBlogProgram();

  return publicKey ? (
    <div>
      <AppHero
        title="Solana Blog"
        subtitle="Create, edit, and delete posts on the Solana blockchain. All data is stored on-chain and secured by your wallet."
      >
        <p className="mb-6">
          Blog Program ID: <ExplorerLink path={`account/${programId}`} label={ellipsify(programId.toString())} />
        </p>
        {/* 将创建表单放在页面顶部 */}
        <PostCreate />
      </AppHero>
      {/* 帖子列表放在下面 */}
      <PostList />
    </div>
  ) : (
    <div className="max-w-4xl mx-auto">
      <div className="hero py-[64px]">
        <div className="hero-content text-center">
          <p className="text-lg mb-4">Please connect your wallet to access the blog.</p>
          <WalletButton />
        </div>
      </div>
    </div>
  );
}