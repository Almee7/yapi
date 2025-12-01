const testReportModel = require('../models/testReport.js');
const interfaceColModel = require('../models/interfaceCol.js');
const baseController = require('./base.js');
const yapi = require('../yapi.js');

class TestReportController extends baseController {
  constructor(ctx) {
    super(ctx);
    this.reportModel = yapi.getInst(testReportModel);
    this.colModel = yapi.getInst(interfaceColModel);
  }

  /**
   * 获取报告列表
   * @interface /test_report/list
   * @method GET
   * @category testReport
   * @param {Number} col_id 测试集合ID (可选)
   * @param {Number} project_id 项目ID (可选)
   * @param {Number} page 页码
   * @param {Number} limit 每页数量
   * @returns {Object}
   */
  async list(ctx) {
    try {
      const { col_id, project_id, page = 1, limit = 20 } = ctx.query;

      if (!col_id && !project_id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, 'col_id或project_id不能同时为空'));
      }

      let list, total;
      if (col_id) {
        list = await this.reportModel.listByColId(+col_id, +page, +limit);
        total = await this.reportModel.countByColId(+col_id);
      } else {
        list = await this.reportModel.listByProjectId(+project_id, +page, +limit);
        total = await this.reportModel.countByProjectId(+project_id);
      }

      ctx.body = yapi.commons.resReturn({
        list,
        total,
        page: +page,
        limit: +limit
      });
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * 获取报告详情
   * @interface /test_report/get
   * @method GET
   * @category testReport
   * @param {String} id 报告ID
   * @returns {Object}
   */
  async get(ctx) {
    try {
      const { id } = ctx.query;

      if (!id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, 'id不能为空'));
      }

      const report = await this.reportModel.get(id);
      
      if (!report) {
        return (ctx.body = yapi.commons.resReturn(null, 404, '报告不存在'));
      }

      ctx.body = yapi.commons.resReturn(report);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * 保存测试报告
   * @interface /test_report/save
   * @method POST
   * @category testReport
   * @param {Number} col_id 测试集合ID
   * @param {String} col_name 测试集合名称
   * @param {Number} project_id 项目ID
   * @param {String} env_name 环境名称
   * @param {Number} total 总数
   * @param {Number} success 成功数
   * @param {Number} failed 失败数
   * @param {String} run_time 执行时间
   * @param {Object} test_result 测试结果
   * @returns {Object}
   */
  async save(ctx) {
    try {
      const params = ctx.request.body;

      if (!params.col_id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, 'col_id不能为空'));
      }

      if (!params.project_id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, 'project_id不能为空'));
      }

      const data = {
        uid: this.getUid(),
        username: this.getUsername(),
        col_id: params.col_id,
        col_name: params.col_name || '',
        project_id: params.project_id,
        env_name: params.env_name || '',
        total: params.total || 0,
        success: params.success || 0,
        failed: params.failed || 0,
        run_time: params.run_time || '',
        test_result: typeof params.test_result === 'string' ? params.test_result : JSON.stringify(params.test_result || {}),
        add_time: yapi.commons.time(),
        status: params.failed > 0 ? 'failed' : 'success'
      };

      const result = await this.reportModel.save(data);

      ctx.body = yapi.commons.resReturn(result);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * 删除报告
   * @interface /test_report/del
   * @method GET
   * @category testReport
   * @param {String} id 报告ID
   * @returns {Object}
   */
  async del(ctx) {
    try {
      const { id } = ctx.query;

      if (!id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, 'id不能为空'));
      }

      const result = await this.reportModel.del(id);

      ctx.body = yapi.commons.resReturn(result);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }
}

module.exports = TestReportController;
