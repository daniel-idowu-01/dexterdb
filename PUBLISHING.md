# Publishing to npm

## Pre-Publishing Checklist

### ✅ Completed
- [x] TypeScript compilation successful
- [x] All dependencies listed in package.json
- [x] Main entry point configured (`dist/index.js`)
- [x] Type definitions included (`dist/index.d.ts`)
- [x] CLI binary configured (`bin.dexterdb`)
- [x] .npmignore file created
- [x] README.md with usage instructions
- [x] License (MIT) specified
- [x] Node.js version requirement (>=18.0.0)

### ⚠️ Known Issues
- Foreign key relations: There's a known issue with foreign key resolution when seeding models with relations. The seeder works perfectly for models without foreign keys. For models with foreign keys, users should seed parent models first.

### 📝 Before Publishing

1. **Update package.json:**
   - [ ] Add your name/email to `author` field
   - [ ] Update `repository.url` with your actual GitHub repo
   - [ ] Update `bugs.url` and `homepage` if you have a repo

2. **Test the build:**
   ```bash
   npm run build
   ```

3. **Verify dist/ folder:**
   ```bash
   ls dist/
   ```
   Should contain: `index.js`, `index.d.ts`, `cli.js`, and all source files

4. **Test locally (optional):**
   ```bash
   npm pack
   npm install -g ./dexterdb-1.0.0.tgz
   ```

5. **Login to npm:**
   ```bash
   npm login
   ```

6. **Publish:**
   ```bash
   npm publish
   ```

   For first-time publish (public):
   ```bash
   npm publish --access public
   ```

## Post-Publishing

1. **Verify installation:**
   ```bash
   npm install -g dexterdb
   dexterdb --version
   ```

2. **Update version for next release:**
   ```bash
   npm version patch  # 1.0.0 -> 1.0.1
   npm version minor  # 1.0.0 -> 1.1.0
   npm version major  # 1.0.0 -> 2.0.0
   ```

## Package Contents

The published package will include:
- `dist/` - Compiled JavaScript and type definitions
- `package.json` - Package metadata
- `README.md` - Documentation
- `.npmignore` - Excludes source files, tests, etc.

## Notes

- The package name `dexterdb` must be unique on npm
- Make sure you own the npm account you're publishing to
- Consider adding a GitHub repository for issues and contributions
- The foreign key relation issue can be documented as a known limitation in the README

