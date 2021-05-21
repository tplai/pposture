var path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'build')
  },
  module: {
    rules: [
        {
            test: /\.jsx?$/,
            use: 'babel-loader',
            exclude: /node_modules/
        },
        {
            test: /\.css$/,
            use: [ 'style-loader', 'css-loader' ]
        },
        {
            test: /\.png$/,
            use: 'file-loader'
        },
        {
            test: /\.svg$/,
            use: 'file-loader'
        },
        {
            test: /\.ico$/,
            use: 'file-loader?name=[name].[ext]'  // <-- retain original file name
        }
    ]
  },
  devServer: {
        contentBase: path.resolve(__dirname, "build")
  }
};
