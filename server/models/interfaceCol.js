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
      source_id: { type: Number }, // 引用的集合ID
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
      },
      // 添加间隔时间字段
      intervalTime: {
        type: Number,
        default: 0
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
    // 使用递归方式获取完整的父子层级关系
    const visited = new Set();
    const resultIds = [];
    
    // 获取指定ID的记录
    const targetCol = await this.model.findOne({ _id: col_id }).lean().exec();
    if (!targetCol) {
      return [col_id];
    }
    
    // 添加自身ID
    resultIds.push(Number(col_id));
    visited.add(Number(col_id));
    
    // 递归获取所有子节点
    const getChildren = async (parentId) => {
      const children = await this.model.find({ parent_id: parentId }).lean().exec();
      for (const child of children) {
        const childId = Number(child._id);
        if (!visited.has(childId)) {
          visited.add(childId);
          resultIds.push(childId);
          // 递归获取子节点的子节点
          await getChildren(childId);
        }
      }
    };
    
    // 获取所有子节点
    await getChildren(col_id);
    
    return resultIds;
  }


  list(project_id) {
    return this.model
      .find({
        project_id: project_id
      })
      .select('name uid project_id desc add_time up_time index parent_id type repeatCount source_id')
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
        .select('name uid project_id desc add_time up_time index parent_id type repeatCount source_id')
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
