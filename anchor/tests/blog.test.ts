import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { Blog } from "../target/types/blog";
import { expect } from "@jest/globals";

// 测试套件：Blog 合约
describe("blog", () => {
  // 获取 Anchor Provider（默认从环境变量读取 keypair 和连接）
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);

  // 获取 Blog Program 实例（自动加载 IDL）
  const program = anchor.workspace.Blog as Program<Blog>;

  // 当前钱包用户（默认为 author）
  const author = provider.wallet;

  // 生成唯一的 Post Slug
  const generatePostSeedSlug = () =>
    `post-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  // 通用：根据 slug 生成 Post PDA
  const getPostPDA = (slug: string): web3.PublicKey => {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("post"),
        author.publicKey.toBuffer(),
        Buffer.from(slug),
      ],
      program.programId
    )[0];
  };

  // 创建 Post 的测试
  it("Creates a post successfully", async () => {
    const slug = generatePostSeedSlug();
    const postAccountPDA = getPostPDA(slug);

    const title = "My First Post";
    const content = "This is the content of my first post.";

    // 创建 Post
    await program.methods
      .createPost(title, content, slug)
      .accounts({
        postAccount: postAccountPDA,
        author: author.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    // 获取链上数据进行断言
    const post = await program.account.post.fetch(postAccountPDA);
    expect(post.author.toBase58()).toEqual(author.publicKey.toBase58());
    expect(post.title).toEqual(title);
    expect(post.content).toEqual(content);
    expect(post.timestamp.toNumber()).toBeGreaterThan(0);
    expect(post.bump).toBeGreaterThanOrEqual(0);
  });

  // 超出标题长度上限
  it("Fails to create a post with a title too long", async () => {
    const slug = generatePostSeedSlug();
    const postAccountPDA = getPostPDA(slug);

    const longTitle = "A".repeat(51); // 超出 50 字符
    const content = "Valid content";

    await expect(
      program.methods
        .createPost(longTitle, content, slug)
        .accounts({
          postAccount: postAccountPDA,
          author: author.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc()
    ).rejects.toThrow("Title cannot exceed 50 characters.");
  });

  // 超出内容长度限制
  it("Fails to create a post with content too long", async () => {
    const slug = generatePostSeedSlug();
    const postAccountPDA = getPostPDA(slug);

    const title = "Valid Title";
    const longContent = "A".repeat(501); // 超出 500 字符

    await expect(
      program.methods
        .createPost(title, longContent, slug)
        .accounts({
          postAccount: postAccountPDA,
          author: author.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc()
    ).rejects.toThrow("Content cannot exceed 500 characters.");
  });

  // 无效 slug（空字符串）
  it("Fails to create a post with invalid slug", async () => {
    const slug = "";
    const postAccountPDA = getPostPDA(slug);

    const title = "Valid Title";
    const content = "Valid content";

    await expect(
      program.methods
        .createPost(title, content, slug)
        .accounts({
          postAccount: postAccountPDA,
          author: author.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc()
    ).rejects.toThrow("The slug is invalid. It must be between 1 and 32 characters long.");
  });

  // 成功编辑 Post
  it("Edits a post successfully", async () => {
    const slug = generatePostSeedSlug();
    const postAccountPDA = getPostPDA(slug);

    await program.methods
      .createPost("Initial Title", "Initial Content", slug)
      .accounts({
        postAccount: postAccountPDA,
        author: author.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    const newTitle = "Updated Title";
    const newContent = "Updated Content";

    await program.methods
      .editPost(newTitle, newContent)
      .accounts({ postAccount: postAccountPDA })
      .rpc();

    const post = await program.account.post.fetch(postAccountPDA);
    expect(post.title).toEqual(newTitle);
    expect(post.content).toEqual(newContent);
  });

  // 非作者尝试编辑 Post（应拒绝）
  it("Fails to edit a post with unauthorized author", async () => {
    const slug = generatePostSeedSlug();
    const postAccountPDA = getPostPDA(slug);

    await program.methods
      .createPost("Initial Title", "Initial Content", slug)
      .accounts({
        postAccount: postAccountPDA,
        author: author.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    const unauthorizedAuthor = web3.Keypair.generate();

    await expect(
      program.methods
        .editPost("New Title", "New Content")
        .accounts({
          postAccount: postAccountPDA,
          author: unauthorizedAuthor.publicKey,
        })
        .signers([unauthorizedAuthor])
        .rpc()
    ).rejects.toThrow("You are not authorized to perform this action.");
  });

  // 成功删除 Post
  it("Deletes a post successfully", async () => {
    const slug = generatePostSeedSlug();
    const postAccountPDA = getPostPDA(slug);

    await program.methods
      .createPost("Title to Delete", "Content to Delete", slug)
      .accounts({
        postAccount: postAccountPDA,
        author: author.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .deletePost()
      .accounts({
        postAccount: postAccountPDA,
      })
      .rpc();

    await expect(program.account.post.fetch(postAccountPDA)).rejects.toThrow();
  });

  // 非作者尝试删除 Post（应拒绝）
  it("Fails to delete a post with unauthorized author", async () => {
    const slug = generatePostSeedSlug();
    const postAccountPDA = getPostPDA(slug);

    await program.methods
      .createPost("Title to Delete", "Content to Delete", slug)
      .accounts({
        postAccount: postAccountPDA,
        author: author.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    const unauthorizedAuthor = web3.Keypair.generate();

    await expect(
      program.methods
        .deletePost()
        .accounts({
          postAccount: postAccountPDA,
          author: unauthorizedAuthor.publicKey,
        })
        .signers([unauthorizedAuthor])
        .rpc()
    ).rejects.toThrow("You are not authorized to perform this action.");
  });
});
