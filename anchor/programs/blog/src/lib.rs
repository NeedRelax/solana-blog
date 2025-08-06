#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

declare_id!("DYFKgZZFwx4PwJdNsaZj7ivCRvueVEqxUAgLSocRTs6Y");

const MAX_TITLE_LENGTH: usize = 50;
const MAX_CONTENT_LENGTH: usize = 500;
const POST_SEED_PREFIX: &'static [u8] = b"post";
const MAX_SLUG_LENGTH: usize = 32;

#[program]
pub mod blog {
    use super::*;
    pub fn create_post(
        ctx: Context<CreatePost>,
        title: String,
        content: String,
        post_seed_slug: String,
    )->Result<()>{
        if title.chars().count() > MAX_TITLE_LENGTH{
            return err!(BlogError::TitleTooLong);
        }
        if content.chars().count() > MAX_CONTENT_LENGTH{
            return err!(BlogError::ContentTooLong);
        }
        if post_seed_slug.is_empty() || post_seed_slug.len() >  MAX_SLUG_LENGTH{
            return err!(BlogError::SlugInvalid);
        }
        let post_account = &mut ctx.accounts.post_account;
        let author = &ctx.accounts.author;

        post_account.author = author.key();
        post_account.title = title;
        post_account.content = content;
        post_account.timestamp = Clock::get()?.unix_timestamp;
        post_account.bump = ctx.bumps.post_account;
        msg!("Post created by author: {}, slug: {}", author.key(), post_seed_slug);

        Ok(())
    }

    pub fn edit_post(ctx: Context<EditPost>, title:String, content: String)-> Result<()>{
        if title.chars().count() > MAX_TITLE_LENGTH{
            return err!(BlogError::TitleTooLong);
        }
        if content.chars().count() > MAX_CONTENT_LENGTH{
            return err!(BlogError::ContentTooLong);
        }
        let post_account = &mut ctx.accounts.post_account;
        post_account.title = title;
        post_account.content = content;
        msg!("Post edit by author {}", ctx.accounts.author.key());
        Ok(())
    }
    pub fn delete_post(ctx: Context<DeletePost>) -> Result<()>{
        msg!("Post deleted by author {}", ctx.accounts.author.key());
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(title:String, content:String, post_seed_slug: String)]
pub struct CreatePost<'info>{
    #[account(
        init,
        payer = author,
        space = Post::INIT_SPACE,
        seeds = [POST_SEED_PREFIX, author.key().as_ref(),post_seed_slug.as_bytes()],
        bump
    )]
    pub post_account:Account<'info, Post>,
    #[account(mut)]
    pub author:Signer<'info>,
    pub system_program: Program<'info,System>,
}
#[derive(Accounts)]
pub struct EditPost<'info>{
    #[account(
        mut,
        has_one = author @ BlogError::Unauthorized,
    )]
    pub post_account: Account<'info, Post>,
    pub author: Signer<'info>,
}
#[derive(Accounts)]
pub struct DeletePost<'info>{
    #[account(
    mut,
    has_one = author @ BlogError::Unauthorized,
    close = author,
    )]
    pub post_account: Account<'info, Post>,
    pub author: Signer<'info>,
}
#[account]
#[derive(InitSpace)]
pub struct Post{
    pub author: Pubkey,
    #[max_len(MAX_TITLE_LENGTH)]
    pub title: String,
    #[max_len(MAX_CONTENT_LENGTH)]
    pub content: String,
    pub timestamp: i64,
    pub bump: u8,
}

#[error_code]
pub enum BlogError{
    #[msg("Title cannot exceed 50 characters.")]
    TitleTooLong,
    #[msg("Content cannot exceed 500 characters.")]
    ContentTooLong,
    #[msg("The slug is invalid. It must be between 1 and 32 characters long.")]
    SlugInvalid,
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,
}