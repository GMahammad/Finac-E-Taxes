const path = require('path');

module.exports = {
  entry: './js/background.js',
  output: {
    filename: 'background.bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  mode: 'production'
};
