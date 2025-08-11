// 假设这是你的 JSON 对象
const jsonObject = {
    type: "object",
    properties: {
        id: { type: "string", description: "" },
        name: { type: "string" },
    },
    required: ["id"]
};

// 序列化：把对象转换成字符串（存库时用）
const jsonString = JSON.stringify(jsonObject);
console.log("序列化后字符串:", jsonString);

// 反序列化：把字符串再解析成对象（读取时用）
const parsedObject = JSON.parse(jsonString);
console.log("反序列化回对象:", parsedObject);
