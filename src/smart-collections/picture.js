module.exports = function() {
  return {
    name: 'Picture',
    idField: 'href',
    fields: [{
      field:'id',
      type: 'String',
    }, {
      field: 'href',
      type: 'String',
    }],
  };
};
