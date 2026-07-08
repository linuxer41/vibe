const Flags = {
  NONE:     0b0000_0000_0000_0000,
  REQUEST:  0b0000_0000_0000_0001,
  RESPONSE: 0b0000_0000_0000_0010,
  ERROR:    0b0000_0000_0000_0100,
  MORE:     0b0000_0000_0000_1000,
}

function hasFlag(flags, flag) {
  return (flags & flag) !== 0
}

module.exports = { Flags, hasFlag }
