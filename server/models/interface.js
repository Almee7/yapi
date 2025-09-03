const yapi = require('../yapi.js');
const baseModel = require('./base.js');

class interfaceModel extends baseModel {
  getName() {
    return 'interface';
  }

  getSchema() {
    return {
      title: { type: String, required: true },
      uid: { type: Number, required: true },
      path: { type: String, required: true },
      method: { type: String, required: true },
      project_id: { type: Number, required: true },
      catid: { type: Number, required: true },
      edit_uid: { type: Number, default: 0 },
      status: { type: String, enum: ['undone', 'done'], default: 'undone' },
      desc: String,
      markdown: String,
      add_time: Number,
      up_time: Number,
      type: { type: String, enum: ['static', 'var'], default: 'static' },
      query_path: {
        path: String,
        params: [
          {
            name: String,
            value: String
          }
        ]
      },
      req_query: [
        {
          name: String,
          value: String,
          example: String,
          desc: String,
          required: {
            type: String,
            enum: ['1', '0'],
            default: '1'
          }
        }
      ],
      req_headers: [
        {
          name: String,
          value: String,
          example: String,
          desc: String,
          required: {
            type: String,
            enum: ['1', '0'],
            default: '1'
          }
        }
      ],
      req_params: [
        {
          name: String,
          desc: String,
          example: String
        }
      ],
      req_body_type: {
        type: String,
        enum: ['form', 'json', 'text', 'file', 'raw' , 'xml']
      },
      req_body_is_json_schema: { type: Boolean, default: false },
      req_body_form: [
        {
          name: String,
          type: { type: String, enum: ['text', 'file'] },
          example: String,
          value: String,
          desc: String,
          required: {
            type: String,
            enum: ['1', '0'],
            default: '1'
          }
        }
      ],
      req_body_other: String,
      res_body_type: {
        type: String,
        enum: ['json', 'text', 'xml', 'raw', 'json-schema']
      },
      res_body: String,
      res_body_is_json_schema: { type: Boolean, default: false },
      custom_field_value: String,
      field2: String,
      field3: String,
      api_opened: { type: Boolean, default: false },
      index: { type: Number, default: 0 },
      tag: Array,
      interface_key: 'string',
      version: 'string'
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

  getBaseinfo(id) {
    return this.model
      .findOne({
        _id: id
      })
      .select('path method uid title project_id cat_id status ')
      .exec();
  }

  getVar(project_id, method) {
    return this.model
      .find({
        project_id: project_id,
        type: 'var',
        method: method
      })
      .select('_id path')
      .exec();
  }

  getByQueryPath(project_id, path, method) {
    return this.model
      .find({
        project_id: project_id,
        'query_path.path': path,
        method: method
      })
      .exec();
  }
  getByInterfaceKey(project_id, interface_key, method, version = null, select) {
    select =
        select || '_id title uid interface_key version method project_id catid edit_uid status add_time up_time type ...';
    const query = {
      project_id,
      interface_key,
      method
    };
    if (version) query.version = version; // 可选，查询指定版本
    return this.model.find(query).select(select).exec();
  }

  getByPath(project_id, path, method, select) {
    select =
      select ||
      '_id title uid path method project_id catid edit_uid status add_time up_time type query_path req_query req_headers req_params req_body_type req_body_form req_body_other res_body_type custom_field_value res_body res_body_is_json_schema req_body_is_json_schema';
    return this.model
      .find({
        project_id: project_id,
        path: path,
        method: method
      })
      .select(select)
      .exec();
  }

  checkRepeat(id, interface_key,version, method) {
    return this.model.countDocuments({
      project_id: id,
      interface_key: interface_key,
      version: version,
      method: method
    });
  }

  countByProjectId(id) {
    return this.model.countDocuments({
      project_id: id
    });
  }

  list(project_id, select) {
    select =
      select || '_id title uid path method project_id catid edit_uid status add_time up_time';
    return this.model
      .find({
        project_id: project_id
      })
      .select(select)
      .sort({ title: 1 })
      .exec();
  }

  listLatestByProject(project_id, option = {},page, limit, select) {
    page = parseInt(page);
    limit = parseInt(limit);
    // 默认返回字段
    select = select || '_id title uid path method project_id catid edit_uid status add_time up_time interface_key version tag';

    // 构造匹配条件
    let match = { project_id: Number(project_id) };

    if (option.status) {
      match.status = Array.isArray(option.status) ? { $in: option.status } : option.status;
    }

    if (option.tag) {
      match.tag = { $in: Array.isArray(option.tag) ? option.tag : [option.tag] };
    }

    // 构造 project 对象
    const projectFields = select.split(' ').reduce((acc, key) => {
      acc[key] = 1;
      return acc;
    }, {});

    return this.model.aggregate([
      { $match: match },
      { $addFields: { versionNum: { $toDouble: "$version" } } },
      { $sort: { versionNum: -1, up_time: -1 } }, // 确保 group 拿到最新版本
      {
        $group: {
          _id: { catid: "$catid", interface_key: "$interface_key" },
          doc: { $first: "$$ROOT" }
        }
      },
      { $replaceRoot: { newRoot: "$doc" } },
      { $project: projectFields },
      { $sort: { catid: 1, up_time: -1 } }, // 分类 + 更新时间
      {
        $facet: {
          list: [
            { $skip: ((page - 1) * limit) },
            { $limit: limit }
          ],
          total: [
            { $count: "count" }
          ]
        }
      }
    ]).exec().then(res => {
      if (!res.length) {
        return { list: [], total: 0 };
      }
      return {
        list: res[0].list,
        total: res[0].total.length ? res[0].total[0].count : 0
      };
    });
  }

  listLatestByCat(catid, option = {}, page = 1, limit = 20, select) {
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    // 默认返回字段
    select = select || '_id title uid path method project_id catid edit_uid status add_time up_time interface_key version tag';

    // 构造匹配条件
    let match = { catid: Number(catid) };

    if (option.status) {
      match.status = Array.isArray(option.status) ? { $in: option.status } : option.status;
    }

    if (option.tag) {
      match.tag = { $in: Array.isArray(option.tag) ? option.tag : [option.tag] };
    }

    // 构造投影字段
    const projectFields = select.split(' ').reduce((acc, key) => {
      acc[key] = 1;
      return acc;
    }, {});

    return this.model.aggregate([
      { $match: match },
      { $addFields: { versionNum: { $toDouble: "$version" } } },
      { $sort: { versionNum: -1, up_time: -1 } }, // 每个 interface_key 最新版本排前
      {
        $group: {
          _id: "$interface_key",
          doc: { $first: "$$ROOT" }  // 去重，每个 interface_key 只保留最新
        }
      },
      { $replaceRoot: { newRoot: "$doc" } },
      { $project: projectFields },
      { $sort: { up_time: -1 } }, // 按更新时间排序
      {
        $facet: {
          list: [
            { $skip: (page - 1) * limit },
            { $limit: limit }
          ],
          total: [
            { $count: "count" }
          ]
        }
      }
    ]).exec().then(res => {
      if (!res.length) return { list: [], total: 0 };
      return {
        list: res[0].list,
        total: res[0].total.length ? res[0].total[0].count : 0
      };
    });
  }


  listVersionByInterfaceKey(interface_key) {
    return this.model
        .find(
            { interface_key },
            { _id: 1, version: 1, up_time: 1 }
        )
        .sort({ up_time: -1 })
        .exec();
  }

  listWithPage(project_id, page, limit) {
    page = parseInt(page);
    limit = parseInt(limit);
    return this.model
      .find({
        project_id: project_id
      })
      .sort({ title: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        '_id title uid path method project_id catid api_opened edit_uid status add_time up_time tag'
      )
      .exec();
  }

  listByPid(project_id) {
    return this.model
      .find({
        project_id: project_id
      })
      .sort({ title: 1 })
      .exec();
  }

  //获取全部接口信息
  getInterfaceListCount() {
    return this.model.countDocuments({});
  }

  listByCatid(catid, select) {
    select =
      select || '_id title uid path method project_id catid edit_uid status add_time up_time index tag';
    return this.model
      .find({
        catid: catid
      })
      .select(select)
      .sort({ index: 1 })
      .exec();
  }

  // Model.js
  listLatestByCatIds(catIds, select) {
    select =
        select ||
        '_id title uid path method project_id catid edit_uid status add_time up_time index tag version interface_key';

    const projectFields = select.split(' ').reduce((acc, key) => {
      acc[key] = 1;
      return acc;
    }, {});

    return this.model
        .aggregate([
          { $match: { catid: { $in: catIds } } },
          {
            $addFields: {
              versionNum: { $toDouble: { $ifNull: ['$version', 0] } }
            }
          },
          { $sort: { interface_key: 1, versionNum: -1, up_time: -1 } },
          {
            $group: {
              _id: { catid: '$catid', interface_key: '$interface_key' },
              doc: { $first: '$$ROOT' }
            }
          },
          { $replaceRoot: { newRoot: '$doc' } },
          { $project: projectFields },
          { $sort: { index: 1 } }
        ])
        .exec();
  }


  listByCatidWithPage(catid, page, limit) {
    page = parseInt(page);
    limit = parseInt(limit);
    return this.model
      .find({
        catid: catid
      })
      .sort({ index: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        '_id title uid path method project_id catid edit_uid api_opened status add_time up_time, index, tag'
      )
      .exec();
  }

  listByOptionWithPage(option, page, limit) {
    page = parseInt(page);
    limit = parseInt(limit);
    return this.model
      .find(option)
      .sort({index: 1})
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        '_id title uid path method project_id catid edit_uid api_opened status add_time up_time, index, tag'
      )
      .exec();
  }

  listByInterStatus(catid, status) {
    let option = {};
    if (status === 'open') {
      option = {
        catid: catid,
        api_opened: true
      };
    } else {
      option = {
        catid: catid
      };
    }
    return this.model
      .find(option)
      .select()
      .sort({ title: 1 })
      .exec();
  }

  del(id) {
    return this.model.remove({
      _id: id
    });
  }

  delByCatid(id) {
    return this.model.remove({
      catid: id
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
      data,
      { runValidators: true }
    );
  }

  upEditUid(id, uid) {
    return this.model.update(
      {
        _id: id
      },
      { edit_uid: uid },
      { runValidators: true }
    );
  }
  getcustomFieldValue(id, value) {
    return this.model
      .find({
        project_id: id,
        custom_field_value: value
      })
      .select(
        'title uid path method edit_uid status desc add_time up_time type query_path req_query req_headers req_params req_body_type req_body_form req_body_other res_body_type custom_field_value'
      )
      .exec();
  }

  listCount(option) {
    return this.model.countDocuments(option);
  }

  upIndex(id, index) {
    return this.model.update(
      {
        _id: id
      },
      {
        index: index
      }
    );
  }

  search(keyword) {
    return this.model
      .find({
        $or: [
          { 'title': new RegExp(keyword, 'ig') },
          { 'path': new RegExp(keyword, 'ig') }
        ]
      })
      .limit(10);
  }
}

module.exports = interfaceModel;