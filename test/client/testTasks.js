const GrpcMongoClient = require('./GrpcMongoClient');

function randomTask() {
    return {
        name: '任务_' + Math.random().toString(36).substring(2, 8),
        status: Math.random() > 0.5 ? 'done' : 'pending',
        createdAt: new Date()
    };
}

(async () => {
    const client = new GrpcMongoClient({
        address: 'localhost:50051',
        timeout: 15000,
        logger: console.log
    });

    try {
        const results = [];

        for (let i = 0; i < 10; i++) {
            const task = randomTask();
            // 这里我们为每个任务加上 taskId（自增）
            const inserted = await client.insertWithAutoIncrement('tasks', task, 'taskId', 'taskId');
            results.push(inserted);
        }

        console.log('✅ 插入带自增 taskId 的任务:', results);

        // 查询一下看看结果
        const allTasks = await client.find('tasks', {});
        console.log('📄 查询结果（所有任务）:', allTasks);

    } catch (err) {
        console.error('❌ 出错:', err.message);
    } finally {
        client.close();
    }
})();



// (async () => {
//     const client = new GrpcMongoClient({
//         address: 'localhost:50051',
//         timeout: 15000,
//         logger: console.log
//     });
//
//     try {
//         // 1. 批量插入随机任务
//         const tasksToInsert = Array.from({ length: 10 }, () => randomTask());
//         const bulkInsertRes = await client.bulkInsert('tasks', tasksToInsert);
//         console.log('✅ 批量插入结果:', bulkInsertRes);
//
//
//         // 2. 简单查找所有任务
//         const allTasks = await client.find('tasks', {});
//         console.log('✅ 查找所有任务，共:', allTasks.length);
//         console.log(allTasks);
//
//         // 3. 分页查找，跳过前5条，限制5条，按priority降序排序
//         const pageTasks = await client.find('tasks', {}, { skip: 5, limit: 5, sort: { priority: -1 } });
//         console.log('✅ 分页查找任务（skip 5, limit 5, priority降序）:');
//         console.log(pageTasks);
//
//         // 4. 更新状态为 pending 的第一个任务为 done
//         const updateRes = await client.update(
//             'tasks',
//             { status: 'pending' },
//             { $set: { status: 'done' } },
//             { upsert: false }
//         );
//         console.log('✅ 更新结果:', updateRes);
//
//         // 5. 删除状态为 done 的任务
//         const removeRes = await client.remove('tasks', { status: 'done' });
//         console.log('✅ 删除 done 状态任务结果:', removeRes);
//
//         // 6. 聚合统计，按状态分组计数
//         const aggRes = await client.aggregate('tasks', [
//             { $group: { _id: "$status", count: { $sum: 1 } } },
//             { $sort: { count: -1 } }
//         ]);
//         console.log('✅ 任务状态统计（聚合查询）:');
//         console.log(aggRes);
//
//     } catch (err) {
//         console.error('❌ 测试异常:', err.message);
//     }
// })();
