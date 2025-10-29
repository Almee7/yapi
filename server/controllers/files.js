const yapi = require('../yapi.js');
const baseController = require('./base.js');
const fileModel = require('../models/files.js');
const crypto = require('crypto');

/**
 * 文件控制器
 * 支持上传（含MD5去重）、下载、删除
 */
class fileController extends baseController {
    constructor(ctx) {
        super(ctx);
        this.Model = yapi.getInst(fileModel);
    }

    /**
     * 上传文件（保存到数据库）
     * 自动根据MD5去重，存在则直接返回原fileId
     * @interface /file/upload
     * @method POST
     * @param {String} name 文件名
     * @param {String} mimeType MIME类型
     * @param {String} base64 Base64内容
     * @param {Number} size 文件大小
     */
    async upload(ctx) {
        try {
            const { name, mimeType, base64, size } = ctx.request.body;
            if (!name || !base64) {
                return (ctx.body = yapi.commons.resReturn(null, 400, '缺少必要参数 name 或 base64'));
            }

            // 计算MD5
            const md5 = crypto.createHash('md5').update(base64).digest('hex');

            // 查重
            let exist = await this.Model.findOne({ md5 });
            if (exist) {
                return (ctx.body = yapi.commons.resReturn({ id: exist._id }, 0, '文件已存在，复用成功'));
            }

            // 新建文件记录
            const data = {
                uid: this.getUid(),
                name,
                mimeType: mimeType || 'application/octet-stream',
                base64,
                size: size || 0,
                md5,
                createdAt: Date.now()
            };

            const result = await this.Model.save(data);
            ctx.body = yapi.commons.resReturn({ id: result._id }, 0, '上传成功');
        } catch (err) {
            ctx.body = yapi.commons.resReturn(null, 500, err.message);
        }
    }

    /**
     * 获取文件详情（可选带base64内容）
     * @interface /file/getFile
     * @method POST
     * @param {String} id 文件ID
     * @param {Boolean} [includeBase64=false] 是否返回base64内容
     */
    async getFile(ctx) {
        try {
            const { id, includeBase64 } = ctx.request.body; // POST 参数从 body 获取
            if (!id) {
                return (ctx.body = yapi.commons.resReturn(null, 400, '缺少参数 id'));
            }

            const file = await this.Model.getFileById(id);
            if (!file) {
                return (ctx.body = yapi.commons.resReturn(null, 404, '文件不存在'));
            }

            const data = {
                _id: file._id,
                name: file.name,
                mimeType: file.mimeType,
                size: file.size,
                uid: file.uid,
                type: file.type,
                create_time: file.create_time
            };

            // 仅在显式需要时返回 base64
            if (includeBase64 === true || includeBase64 === 'true') {
                data.base64 = file.base64;
            }

            ctx.body = yapi.commons.resReturn(data, 0, '获取成功');
        } catch (err) {
            ctx.body = yapi.commons.resReturn(null, 500, err.message);
        }
    }


    /**
     * 删除文件
     * @interface /file/delete
     * @method POST
     * @param {String} id 文件ID
     */
    async delete(ctx) {
        try {
            const { id } = ctx.request.body;
            if (!id) {
                return (ctx.body = yapi.commons.resReturn(null, 400, '缺少参数 id'));
            }

            const result = await this.Model.deleteOne({ _id: id });
            if (result.deletedCount === 0) {
                return (ctx.body = yapi.commons.resReturn(null, 404, '文件不存在或已删除'));
            }

            ctx.body = yapi.commons.resReturn(true, 0, '删除成功');
        } catch (err) {
            ctx.body = yapi.commons.resReturn(null, 500, err.message);
        }
    }
}

module.exports = fileController;
