'use client';

import { PublicKey } from '@solana/web3.js';
import { useState, useMemo, SetStateAction } from 'react'
import { ExplorerLink } from '../cluster/cluster-ui'
import { useBlogProgram, useBlogPostProgramAccount } from './blog-data-access'
import { ellipsify } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useWallet } from '@solana/wallet-adapter-react'

// Slug 生成辅助函数
const generateSlug = (title: string, maxLength: number = 32): string => {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .substring(0, maxLength)
}

/**
 * 创建新帖子的表单组件
 */
export function PostCreate() {
  const { createPostMutation } = useBlogProgram()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [slug, setSlug] = useState('')

  const handleSubmit = () => {
    if (!title || !content || !slug) {
      alert('Please fill in all fields.')
      return
    }
    createPostMutation.mutateAsync({ title, content, slug }).then(() => {
      // 成功后清空表单
      setTitle('')
      setContent('')
      setSlug('')
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a New Post</CardTitle>
        <CardDescription>Write something amazing and store it forever on Solana.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Input
          placeholder="Post Title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setSlug(generateSlug(e.target.value))
          }}
        />
        <Input
          placeholder="URL Slug (auto-generated)"
          value={slug}
          onChange={(e) => setSlug(generateSlug(e.target.value))}
        />
        <Textarea
          placeholder="What's on your mind?"
          value={content}
          onChange={(e: { target: { value: SetStateAction<string> } }) => setContent(e.target.value)}
          rows={5}
        />
      </CardContent>
      <CardFooter>
        <Button onClick={handleSubmit} disabled={createPostMutation.isPending}>
          {createPostMutation.isPending ? 'Publishing...' : 'Publish Post'}
        </Button>
      </CardFooter>
    </Card>
  )
}

/**
 * 展示所有帖子的列表
 */
export function PostList() {
  const { postsQuery, getProgramAccount } = useBlogProgram();

  if (getProgramAccount.isLoading) {
    return <div className="flex justify-center w-full"><span className="loading loading-spinner loading-lg"></span></div>;
  }
  if (!getProgramAccount.data?.value) {
    return (
      <div className="alert alert-info flex justify-center mt-6">
        <span>Program account not found. Make sure you have deployed the program and are on the correct cluster.</span>
      </div>
    );
  }

  return (
    <div className={'space-y-6 mt-8'}>
      {postsQuery.isLoading ? (
        <div className="flex justify-center w-full"><span className="loading loading-spinner loading-lg"></span></div>
      ) : postsQuery.data?.length ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {postsQuery.data.map((post) => (
            <PostCard key={post.publicKey.toString()} account={post.publicKey} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <h2 className={'text-2xl font-bold'}>No Posts Yet</h2>
          <p className="text-gray-500">Be the first one to create a post!</p>
        </div>
      )}
    </div>
  );
}

/**
 * 单个帖子的卡片展示，包含编辑和删除功能
 */
function PostCard({ account }: { account: PublicKey }) {
  const { postQuery, updatePostMutation, deletePostMutation } = useBlogPostProgramAccount({ account });
  const { publicKey } = useWallet();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const post = postQuery.data;
  const isAuthor = publicKey && post && post.author.equals(publicKey);

  // useMemo 来避免不必要的日期格式化
  const postDate = useMemo(() => {
    if (!post?.timestamp) return '';
    return new Date(post.timestamp.toNumber() * 1000).toLocaleString();
  }, [post?.timestamp]);

  // 进入编辑模式时，填充表单
  const handleEditClick = () => {
    if (!post) return;
    setTitle(post.title);
    setContent(post.content);
    setIsEditing(true);
  };

  // 提交更新
  const handleUpdateSubmit = () => {
    updatePostMutation.mutateAsync({ title, content })
      .then(() => setIsEditing(false));
  };

  // 删除
  const handleDelete = () => {
    if (!window.confirm("Are you sure? This action is irreversible.")) return;
    deletePostMutation.mutateAsync();
  };

  if (postQuery.isLoading) {
    return <div className="flex justify-center w-full"><span className="loading loading-spinner loading-lg"></span></div>;
  }
  if (!post) {
    return <div className="text-red-500">Post not found. It might have been deleted.</div>
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        {isEditing ? (
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-xl font-bold" />
        ) : (
          <CardTitle>{post.title}</CardTitle>
        )}
        <CardDescription>
          By: <ExplorerLink path={`account/${post.author}`} label={ellipsify(post.author.toString())} />
          <br />
          {postDate}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        {isEditing ? (
          <Textarea
            value={content}
            onChange={(e: { target: { value: SetStateAction<string> } }) => setContent(e.target.value)}
            rows={6}
          />
        ) : (
          <p className="whitespace-pre-wrap">{post.content}</p>
        )}
      </CardContent>
      {isAuthor && (
        <CardFooter className="flex justify-end gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateSubmit} disabled={updatePostMutation.isPending}>
                {updatePostMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleEditClick}>
                Edit
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deletePostMutation.isPending}>
                {deletePostMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </>
          )}
        </CardFooter>
      )}
    </Card>
  )
}