const baseModel = require('./base.js');
// const mongoose = require('mongoose');
// const Schema = mongoose.Schema;

class fileModel extends baseModel {
    getName() {
        return 'file';
    }

    getSchema() {
        return {
            uid: { type: Number, required: true }, // 上传用户
            name: { type: String, required: true }, // 文件名
            mimeType: { type: String, default: 'application/octet-stream' },
            size: { type: Number, required: true }, // 文件大小 (bytes)
            md5: { type: String, unique: true }, // 文件内容哈希（用于去重）
            base64: { type: String, required: true }, // base64编码的文件数据
            create_time: { type: Number, default: Date.now },
            type: { type: String, default: 'general' } // 可扩展字段，如 excel、avatar等
        };
    }

    save(data) {
        let doc = new this.model({
            uid: data.uid,
            name: data.name,
            mimeType: data.mimeType,
            size: data.size,
            base64: data.base64,
            md5: data.md5,
            type: data.type || 'general'
        });
        return doc.save();
    }

    getFileById(id) {
        return this.model.findOne({ _id: id }).exec();
    }

    deleteFileById(id) {
        return this.model.deleteOne({ _id: id });
    }

    findOne(conditions) {
        return this.model.findOne(conditions).exec();
    }
}

module.exports = fileModel;
