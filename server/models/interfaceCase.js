const yapi = require('../yapi.js');
const baseModel = require('./base.js');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

class interfaceCase extends baseModel {
  getName() {
    return 'interface_case';
  }

  getSchema() {
    return {
      casename: { type: String, required: true },
      uid: { type: Number, required: true },
      col_id: { type: Number, required: true },
      index: { type: Number, default: 0 },
      project_id: { type: Number, required: true },
      interface_id: { type: Number, required: true },
      parent_id: Number,
      group_id: Number,
      add_time: Number,
      up_time: Number,
      case_env: { type: String },
      req_params: [
        {
          name: String,
          value: String
        }
      ],
      req_headers: [
        {
          name: String,
          value: String
        }
      ],
      req_query: [
        {
          name: String,
          value: String,
          enable: { type: Boolean, default: true }
        }
      ],
      req_body_form: [
        {
          name: String,
          value: Schema.Types.Mixed,
          enable: { type: Boolean, default: true }
        }
      ],
      req_body_other: String,
      test_res_body: String,
      test_status: { type: String, enum: ['ok', 'invalid', 'error', ''] },
      test_res_header: Schema.Types.Mixed,
      mock_verify: { type: Boolean, default: false },
      enable_script: { type: Boolean, default: false },
      enable_async: { type: Boolean, default: false },
      test_script: String,
      pre_request_script: String
    };
  }

  save(data) {
    let m = new this.model(data);
    return m.save();
  }

  //获取全部测试接口信息
  getInterfaceCaseListCount() {
    return this.model.countDocuments({});
  }

  get(id) {
    return this.model
      .findOne({
        _id: id
      })
      .exec();
  }

  list(col_id, select) {
    select = select || 'casename uid col_id _id index interface_id project_id';

    // 判断 col_id 是否是数组，如果是数组则使用 $in 查询
    const query = Array.isArray(col_id)
        ? { col_id: { $in: col_id } }
        : { col_id: col_id };

    let dbQuery = this.model.find(query).sort({ index: 1 }); // 按 index 升序排序

    if (select !== 'all') {
      dbQuery = dbQuery.select(select);
    }

    return dbQuery.exec();
  }

  newList(col_id, select) {
    select = select || 'casename uid col_id _id index interface_id project_id group_id parent_id';
    const query = Array.isArray(col_id) ? { col_id: { $in: col_id } } : { col_id: col_id };

    let dbQuery = this.model.find(query).sort({ index: 1 }); // 按 index 升序排序
    if (select !== 'all') dbQuery = dbQuery.select(select);

    return dbQuery.lean().exec(); // ✅ 使用 lean() 返回普通对象
  }


  del(id) {
    return this.model.remove({
      _id: id
    });
  }

  delByProjectId(id) {
    return this.model.remove({
      project_id: id
    });
  }

  delByInterfaceId(id) {
    return this.model.remove({
      interface_id: id
    });
  }

  delByCol(colIds) {
    const ids = Array.isArray(colIds) ? colIds : [colIds];
    return this.model.deleteMany({
      col_id: { $in: ids }
    });
  }

  up(id, data) {
    data.up_time = yapi.commons.time();
    return this.model.update({ _id: id }, data);
  }

  upCaseIndex(id, index) {
    return this.model.update(
      {
        _id: id
      },
      {
        index: index
      }
    );
  }
  update(id, data) {
    // data 示例: { index: 2, parent_id: 0 }
    return this.model.update(
        { _id: id },
        data
    );
  }
  async getMaxIndexByContainer(col_id, group_id = null) {
    col_id = Number(col_id);

    const query = { col_id };
    if (group_id !== null) {
      query.group_id = group_id;
    } else {
      query.group_id = null;
    }

    // 查当前容器下最大的 index
    const doc = await this.model
        .find(query)
        .sort({ index: -1 })
        .limit(1)
        .exec();

    return doc.length ? doc[0].index : -1;
  }

  async getMaxIndex(col_id) {
    let lastCase = await this.model
        .find({ col_id })
        .sort({ index: -1 })   // 按 index 倒序，最大值在最前面
        .limit(1)
        .exec();

    if (lastCase.length === 0) {
      return 0; // 没有数据时，最大 index 为 0
    }
    return lastCase[0].index;
  }
}

module.exports = interfaceCase;
