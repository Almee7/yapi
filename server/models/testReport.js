const baseModel = require('./base.js');

class TestReport extends baseModel {
  getName() {
    return 'test_report';
  }

  getSchema() {
    return {
      uid: { type: Number, required: true }, // 执行用户ID
      username: { type: String, required: true }, // 执行用户名
      col_id: { type: Number, required: true }, // 测试集合ID
      col_name: { type: String, required: true }, // 测试集合名称(场景名称)
      project_id: { type: Number, required: true }, // 项目ID
      env_name: { type: String, default: '' }, // 执行环境名称
      total: { type: Number, default: 0 }, // 总数
      success: { type: Number, default: 0 }, // 成功数
      failed: { type: Number, default: 0 }, // 失败数
      run_time: { type: String, default: '' }, // 执行时间(如 "1.2s")
      test_result: { type: String, default: '{}' }, // 完整测试结果JSON字符串
      add_time: { type: Number, required: true }, // 创建时间戳
      status: { type: String, default: 'success' } // success, failed, error
    };
  }

  save(data) {
    let m = new this.model(data);
    return m.save();
  }

  // 根据集合ID获取报告列表
  listByColId(col_id, page = 1, limit = 20) {
    return this.model
      .find({ col_id })
      .sort({ add_time: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
  }

  // 根据项目ID获取报告列表
  listByProjectId(project_id, page = 1, limit = 20) {
    return this.model
      .find({ project_id })
      .sort({ add_time: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
  }

  // 获取报告详情
  get(id) {
    return this.model.findOne({ _id: id }).exec();
  }

  // 删除报告
  del(id) {
    return this.model.deleteOne({ _id: id });
  }

  // 统计数量
  countByColId(col_id) {
    return this.model.countDocuments({ col_id });
  }

  countByProjectId(project_id) {
    return this.model.countDocuments({ project_id });
  }
}

module.exports = TestReport;
