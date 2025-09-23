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
      add_time: Number,
      up_time: Number,
      index: { type: Number, default: 0 },
      test_report: { type: String, default: '{}' },
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
    // 查询整个表
    const allData = await this.model.find({}).lean().exec();

    // 构建 parent_id -> 子节点 Map
    const map = new Map();
    for (const item of allData) {
      const pid = item.parent_id?.toString() || null;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid).push(item);
    }

    // 非递归获取所有子级 col_id（不包含自己）
    const stack = [...(map.get(col_id?.toString()) || [])]; // 初始栈放直接子节点
    const resultIds = [];

    while (stack.length > 0) {
      const node = stack.pop();
      resultIds.push(node._id); // 只保存 col_id

      const children = map.get(node._id?.toString()) || [];
      for (const child of children) {
        stack.push(child);
      }
    }

    // 如果找不到子级，返回原来的 col_id
    if (resultIds.length === 0) {
      return [col_id];
    }

    return resultIds; // 返回 col_id 数组
  }

  list(project_id) {
    return this.model
      .find({
        project_id: project_id
      })
      .select('name uid project_id desc add_time up_time index parent_id')
      .exec();
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
  async getMaxIndex(parent_id) {
    let doc = await this.model
        .findOne({parent_id: parent_id})   // 筛选条件：当前集合
        .sort({index: -1})           // 按 index 倒序取第一个
        .exec();

    return doc ? doc.index : -1;      // 如果没有数据就返回 0
  }
}

module.exports = interfaceCol;
