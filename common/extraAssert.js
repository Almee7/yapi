const xpath = require("xpath");
const { DOMParser } = require("xmldom");

class ExtraAssert {
    // ================== 数组/值相关 ==================
    static in(checkValue, container, msg) {
        if (!Array.isArray(container)) {
            throw new Error(`in: container must be an array, got ${typeof container}`);
        }
        if (!container.includes(checkValue)) {
            throw new Error(
                msg || `Assertion failed: value=${JSON.stringify(checkValue)} (type=${typeof checkValue}) not in ${JSON.stringify(container)}`
            );
        }
    }

    static not_in(checkValue, container, msg) {
        if (!Array.isArray(container)) {
            throw new Error(`not_in: container must be an array, got ${typeof container}`);
        }
        if (container.includes(checkValue)) {
            throw new Error(
                msg || `Assertion failed: value=${JSON.stringify(checkValue)} (type=${typeof checkValue}) should not be in ${JSON.stringify(container)}`
            );
        }
    }

    static exists(checkValue, msg) {
        if (checkValue === null || checkValue === undefined) {
            throw new Error(
                msg || `Assertion failed: value=${JSON.stringify(checkValue)} (type=${typeof checkValue}) does not exist`
            );
        }
    }

    static not_exists(checkValue, msg) {
        if (checkValue !== null && checkValue !== undefined) {
            throw new Error(
                msg || `Assertion failed: value=${JSON.stringify(checkValue)} (type=${typeof checkValue}) should not exist`
            );
        }
    }

    static subset(sub, container, msg) {
        if (!Array.isArray(container) || !Array.isArray(sub)) {
            throw new Error(
                `subset: both must be arrays, got sub type=${typeof sub}, container type=${typeof container}`
            );
        }
        if (!sub.every(v => container.includes(v))) {
            throw new Error(
                msg || `Assertion failed: sub=${JSON.stringify(sub)} (type=${typeof sub}) is not subset of ${JSON.stringify(container)}`
            );
        }
    }

    // ================== XML 断言 ==================
    /**
     * 判断 XML 节点值是否等于预期
     * @param {string} xmlStr XML 字符串
     * @param {string} xpathExpr XPath 表达式
     * @param {*} expectedValue 期望值
     * @param {string} msg 可选自定义消息
     */
    static xmlEquals(xmlStr, xpathExpr, expectedValue, msg) {
        const doc = new DOMParser().parseFromString(xmlStr);
        const nodes = xpath.select(xpathExpr, doc);

        if (!nodes || nodes.length === 0) {
            throw new Error(msg || `Assertion failed: XPath ${xpathExpr} not found in XML`);
        }

        const actualValue = nodes[0].textContent;
        if (actualValue !== expectedValue) {
            throw new Error(
                msg || `Assertion failed: XPath ${xpathExpr} value="${actualValue}" !== expected="${expectedValue}"`
            );
        }
    }

    /**
     * 判断 XML 节点是否存在
     * @param {string} xmlStr XML 字符串
     * @param {string} xpathExpr XPath 表达式
     * @param {string} msg 可选自定义消息
     */
    static xmlExists(xmlStr, xpathExpr, msg) {
        const doc = new DOMParser().parseFromString(xmlStr);
        const nodes = xpath.select(xpathExpr, doc);

        if (!nodes || nodes.length === 0) {
            throw new Error(msg || `Assertion failed: XPath ${xpathExpr} not found in XML`);
        }
    }
}

// ================== 导出对象 ==================
module.exports = {
    in: ExtraAssert.in,
    not_in: ExtraAssert.not_in,
    exists: ExtraAssert.exists,
    not_exists: ExtraAssert.not_exists,
    subset: ExtraAssert.subset,
    xmlEquals: ExtraAssert.xmlEquals,
    xmlExists: ExtraAssert.xmlExists
};
