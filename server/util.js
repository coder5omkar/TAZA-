/* Small shared helpers */

function wrap(fn) {
  return function (req, res, next) {
    fn(req, res, next).catch(next);
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

module.exports = { wrap, pad2 };
