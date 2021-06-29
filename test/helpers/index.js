const {expect} = require('chai');

const expectBignumberEqual = (a, b) => expect(a.toString()).to.be.equal(b.toString());

module.exports = {
  expect,
  expectBignumberEqual
};
