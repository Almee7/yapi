const fs = require('fs-extra');
const yapi = require('./yapi.js');
const commons = require('./utils/commons');
const dbService = require('./utils/dbService'); // grpc 封装，支持 executeSQL(sql, params) 返回 Promise
const userModel = require('./models/user.js'); // 用户模型（定义用户数据结构）

yapi.commons = commons;

async function install() {
    const lockFilePath = yapi.commons.fileExist(yapi.path.join(yapi.WEBROOT_RUNTIME, 'init.lock'));
    const exist = yapi.commons.fileExist(lockFilePath);

    if (exist) {
        throw new Error(
            'init.lock文件已存在，请确认您是否已安装。如果需要重新安装，请删掉init.lock文件'
        );
    }

    try {
        await setupSql();

        fs.ensureFileSync(lockFilePath);
        console.log(
            `初始化管理员账号成功,账号名："${yapi.WEBCONFIG.adminAccount}"，密码："ymfe.org"`
        );
        process.exit(0);
    } catch (err) {
        console.error('初始化失败:', err);
        process.exit(1);
    }
}

async function setupSql() {
    // 建表语句（MySQL 版本）
    await dbService.executeSQL(`
    CREATE TABLE IF NOT EXISTS user (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL,
      email VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(100) NOT NULL,
      passsalt VARCHAR(32) NOT NULL,
      role VARCHAR(20) NOT NULL,
      add_time INT NOT NULL,
      up_time INT NOT NULL,
      INDEX idx_username (username)
    );
  `);

    await dbService.executeSQL(`
    CREATE TABLE IF NOT EXISTS project (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uid INT,
      name VARCHAR(255),
      group_id INT,
      INDEX idx_uid (uid),
      INDEX idx_name (name),
      INDEX idx_group_id (group_id)
    );
  `);

    await dbService.executeSQL(`
    CREATE TABLE IF NOT EXISTS log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uid INT,
      typeid INT,
      type VARCHAR(50),
      INDEX idx_uid (uid),
      INDEX idx_typeid_type (typeid, type)
    );
  `);

    await dbService.executeSQL(`
    CREATE TABLE IF NOT EXISTS interface_col (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uid INT,
      project_id INT,
      INDEX idx_uid (uid),
      INDEX idx_project_id (project_id)
    );
  `);

    await dbService.executeSQL(`
    CREATE TABLE IF NOT EXISTS interface_cat (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uid INT,
      project_id INT,
      INDEX idx_uid (uid),
      INDEX idx_project_id (project_id)
    );
  `);

    await dbService.executeSQL(`
    CREATE TABLE IF NOT EXISTS interface_case (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uid INT,
      col_id INT,
      project_id INT,
      INDEX idx_uid (uid),
      INDEX idx_col_id (col_id),
      INDEX idx_project_id (project_id)
    );
  `);

    await dbService.executeSQL(`
    CREATE TABLE IF NOT EXISTS interface (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uid INT,
      path VARCHAR(255),
      method VARCHAR(10),
      project_id INT,
      INDEX idx_uid (uid),
      INDEX idx_path_method (path, method),
      INDEX idx_project_id (project_id)
    );
  `);

    await dbService.executeSQL(`
    CREATE TABLE IF NOT EXISTS \`group\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uid INT,
      group_name VARCHAR(255),
      INDEX idx_uid (uid),
      INDEX idx_group_name (group_name)
    );
  `);

    await dbService.executeSQL(`
    CREATE TABLE IF NOT EXISTS avatar (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uid INT,
      INDEX idx_uid (uid)
    );
  `);

    await dbService.executeSQL(`
    CREATE TABLE IF NOT EXISTS token (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT,
      INDEX idx_project_id (project_id)
    );
  `);

    await dbService.executeSQL(`
    CREATE TABLE IF NOT EXISTS follow (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uid INT,
      project_id INT,
      INDEX idx_uid (uid),
      INDEX idx_project_id (project_id)
    );
  `);

    // 插入管理员账号
    const passsalt = yapi.commons.randStr();
    const username = yapi.WEBCONFIG.adminAccount.split('@')[0];
    const email = yapi.WEBCONFIG.adminAccount;
    const password = yapi.commons.generatePassword('ymfe.org', passsalt);
    const now = yapi.commons.time();

    // 查询管理员账号是否存在
    const existingUsers = await dbService.executeSQL(
        'SELECT COUNT(*) as cnt FROM user WHERE email = ?',
        [email]
    );

    if (existingUsers && existingUsers[0] && existingUsers[0].cnt > 0) {
        console.log('管理员账号已存在，跳过插入');
    } else {
        await dbService.executeSQL(
            'INSERT INTO user (username, email, password, passsalt, role, add_time, up_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [username, email, password, passsalt, 'admin', now, now]
        );
    }
}

install();
