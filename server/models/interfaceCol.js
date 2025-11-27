const yapi = require('../yapi.js');
const baseModel = require('./base.js');

class interfaceCol extends baseModel {
  getName() {
    return 'interface_col';
  }

  getSchema() {
    return {
      name: { type: String, required: true },
      uid: { type: Number, required: true },
      project_id: { type: Number, required: true },
      parent_id: { type: Number, default: 0 },
      desc: String,
      type: { type: String, required: true , default: 'folder' },
      add_time: Number,
      up_time: Number,
      repeatCount: Number,
      index: { type: Number, default: 0 },
      test_report: { type: String, default: '{}' },
      stopFail: {
        type:Boolean,
        default: false
      },
      checkHttpCodeIs200: {
        type:Boolean,
        default: false
      },
      checkResponseSchema: {
        type:Boolean,
        default: false
      },
      checkResponseField: {
        name: {
          type: String,
          required: true,
          default: "code"
        },
        value: {
          type: String,
          required: true,
          default: "0"
        },
        enable: {
          type: Boolean,
          default: false
        }
      },
      checkScript: {
        content: {
          type: String
        },
        enable: {
          type: Boolean,
          default: false
        }
      }
    };
  }

  save(data) {
    let m = new this.model(data);
    return m.save();
  }

  get(id) {
    return this.model
      .findOne({
        _id: id
      })
      .exec();
  }

  checkRepeat(name) {
    return this.model.countDocuments({
      name: name
    });
  }

  async getParentId(col_id) {
    const allData = await this.model.find({}).lean().exec();

    const map = new Map();
    for (const item of allData) {
      const pid = item.parent_id != null ? Number(item.parent_id) : null;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid).push(item);
    }

    const resultIds = [];

    function traverse(id) {
      resultIds.push(Number(id)); // 父
      const children = map.get(Number(id)) || [];
      for (const child of children) traverse(child._id); // 按顺序遍历子节点
    }

    traverse(col_id);
    return resultIds;
  }


  list(project_id) {
    return this.model
      .find({
        project_id: project_id
      })
      .select('name uid project_id desc add_time up_time index parent_id')
      .exec();
  }

  allColList(col_id, select) {
    select = select || 'name uid project_id desc add_time up_time index parent_id type repeatCount';
    const query = Array.isArray(col_id) ? { _id: { $in: col_id } } : { _id: col_id };
    let dbQuery = this.model.find(query);
    if (select !== 'all') dbQuery = dbQuery.select(select);

    return dbQuery.lean().exec(); // ✅ 使用 lean() 返回普通对象
  }

  newList(project_id) {
    return this.model
        .find({ project_id })
        .select('name uid project_id desc add_time up_time index parent_id type repeatCount')
        .lean() // 返回普通对象
        .exec();
  }

  del(ids) {
    // 如果传入单个 id，则包装成数组
    const idArr = Array.isArray(ids) ? ids : [ids];
    return this.model.deleteMany({
      _id: { $in: idArr }
    });
  }

  delByProjectId(id) {
    return this.model.remove({
      project_id: id
    });
  }

  up(id, data) {
    data.up_time = yapi.commons.time();
    return this.model.update(
      {
        _id: id
      },
      data
    );
  }

  upColIndex(id, index) {
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
  async getMaxIndex(parent_id) {
    let doc = await this.model
        .findOne({parent_id: parent_id})   // 筛选条件：当前集合
        .sort({index: -1})           // 按 index 倒序取第一个
        .exec();
    return doc ? doc.index : -1;      // 如果没有数据就返回 0
  }

  async getIndexByParentId(project_id,parent_id) {
    parent_id = Number(parent_id) || 0;
    project_id = Number(project_id);
    let doc = await this.model
        .findOne({ parent_id, project_id })
        .sort({ index: -1 })
        .exec();
    return doc ? doc.index : -1;
  }
}

module.exports = interfaceCol;
