const fs = require('fs');
const path = require('path');

const targetDir = path.resolve(__dirname, 'client'); // 根目录下的 client 目录
const scssExt = /\.scss$/;

// 查找所有 SCSS 文件
function walk(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath, fileList);
        } else if (scssExt.test(file)) {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

// 替换内容
function transformScss(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    let hasMixin = false;
    let hasCommon = false;

    // 替换 @import 并记录是否引用了 mixin/common
    content = content.replace(/@import\s+['"]([^'"]*mixin\.scss)['"];/g, (_match, path) => {
        hasMixin = true;
        return `@use '${path}' as mixin;`;
    });

    content = content.replace(/@import\s+['"]([^'"]*common\.scss)['"];/g, (_match, path) => {
        hasCommon = true;
        return `@use '${path}' as common;`;
    });

    // 替换 $变量 为 mixin.$变量 或 common.$变量
    content = content.replace(/(^|[^a-zA-Z0-9-_])\$([a-zA-Z0-9-_]+)/g, (match, prefix, name) => {
        if (hasMixin) return `${prefix}mixin.$${name}`;
        if (hasCommon) return `${prefix}common.$${name}`;
        return match; // 不变
    });

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✔️  Processed: ${filePath}`);
}

// 执行处理
const files = walk(targetDir);
files.forEach(transformScss);

console.log('✅ 所有 SCSS 文件处理完毕');
