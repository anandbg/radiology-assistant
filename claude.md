# Claude Instructions & Guidelines

## 🚨 CRITICAL: Git and Deployment Restrictions

**ALWAYS ASK PERMISSION BEFORE:**
- Any Git operations (commit, push, pull, etc.)
- GitHub operations (creating repos, pushing code, etc.)  
- Production deployments to Cloudflare Pages
- Any permanent changes that affect version control or live systems

**DO NOT execute these commands without explicit user permission:**
```bash
# Git operations - ASK FIRST
git commit
git push
git pull
git merge

# GitHub operations - ASK FIRST  
gh repo create
setup_github_environment (unless user explicitly requests it)
git push origin main

# Deployment operations - ASK FIRST
wrangler pages deploy
setup_cloudflare_api_key (unless user explicitly requests it)
npm run deploy
```

## ✅ Safe Operations (No Permission Needed)
- Reading files and code analysis
- Local development and testing
- Building the project (`npm run build`)
- Starting/stopping local services with PM2
- Code modifications and file edits
- Database operations in local development mode
- Installing dependencies
- Running tests and debugging

## 🔄 Workflow Guidelines

1. **Development Phase**: Work freely on code, local testing, debugging
2. **Ready to Commit**: ASK user before any git operations
3. **Ready to Deploy**: ASK user before any production deployment

## 📝 Always Confirm With User

When ready for Git/deployment operations, ask questions like:
- "Should I commit these changes to git?"
- "Are you ready to push this code to GitHub?"  
- "Should I deploy this to production on Cloudflare Pages?"
- "Do you want me to set up GitHub/Cloudflare authentication now?"

## 🎯 Default Behavior

- Focus on development and local testing
- Build and improve code functionality
- Test everything locally first
- Only suggest Git/deployment when code is stable and tested
- Always get explicit confirmation before permanent operations

---

**Remember**: Development is free, but Git commits and production deployments require user approval!