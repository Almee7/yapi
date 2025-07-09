const Safeify = require('safeify').default;
const assert = require('assert');

module.exports = async function sandboxFn(context = {}, script) {
  const safeVm = new Safeify({
    timeout: 3000,
    asyncTimeout: 60000
  });

  // 直接注入 assert 对象
  context.assert = assert;

  script += "; return null;";

  const result = await safeVm.run(script, context);

  safeVm.destroy();

  return result;
};
