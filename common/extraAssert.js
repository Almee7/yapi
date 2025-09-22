class ExtraAssert {
    static in(checkValue, container, msg) {
        if (!Array.isArray(container)) throw new Error("in: container must be an array");
        if (!container.includes(checkValue)) throw new Error(msg || `${checkValue} not in array`);
    }

    static not_in(checkValue, container, msg) {
        if (!Array.isArray(container)) throw new Error("not_in: container must be an array");
        if (container.includes(checkValue)) throw new Error(msg || `${checkValue} should not be in array`);
    }

    static exists(checkValue, msg) {
        if (checkValue === null || checkValue === undefined) {
            throw new Error(msg || `Value does not exist`);
        }
    }

    static not_exists(checkValue, msg) {
        if (checkValue !== null && checkValue !== undefined) {
            throw new Error(msg || `Value should not exist`);
        }
    }

    static subset(sub, container, msg) {
        if (!Array.isArray(container) || !Array.isArray(sub)) {
            throw new Error("subset: both must be arrays");
        }
        if (!sub.every(v => container.includes(v))) {
            throw new Error(msg || `${sub} is not subset of ${container}`);
        }
    }
}

// ✅ 导出对象
module.exports = {
    in: ExtraAssert.in,
    not_in: ExtraAssert.not_in,
    exists: ExtraAssert.exists,
    not_exists: ExtraAssert.not_exists,
    subset: ExtraAssert.subset
};
