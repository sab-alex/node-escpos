'use strict';
const getPixels = require('get-pixels');

/**
 * [Image description]
 * @param {[type]} pixels [description]
 */
function Image(pixels){
  if(!(this instanceof Image)) 
    return new Image(pixels);
  this.pixels = pixels;

  this.data = [];

  var self = this;
  for(var i=0;i<this.pixels.data.length;i+=this.size.colors){
    this.data.push((function () {
      var agreagtor = 0;
      for (var j = 0; j < self.size.colors; j++) {
        agreagtor = this.pixels.data[i + j] !== 0xFF ? 1 : agreagtor;
      }
      return agreagtor;
    }.bind(this))());
  };
};

/**
 * [load description]
 * @param  {[type]}   url      [description]
 * @param  {[type]}   type     [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
Image.load = function(url, type, callback){
  if(typeof type == 'function'){
    callback = type;
    type = null;
  }
  getPixels(url, type, function(err, pixels){
    if(err) return callback(err);
    callback(new Image(pixels));
  });
};

/**
 * [description]
 * @return {[type]}     [description]
 */
Image.prototype.__defineGetter__('size', function(){
  return {
    width : this.pixels.shape[0],
    height: this.pixels.shape[1],
    colors: this.pixels.shape[2],
  };
});

/**
 * [toBitmap description]
 * @param  {[type]} density [description]
 * @return {[type]}         [description]
 */
Image.prototype.toBitmap = function(density) {
  density = density || 24;

  var ld, result = [];
  var x, y, b, l, i;
  var c = density / 8;

  // n blocks of lines
  var n = Math.ceil(this.size.height / density);

  for (y = 0; y < n; y++) {
    // line data
    ld = result[y] = [];

    for (x = 0; x < this.size.width; x++) {

      for (b = 0; b < density; b++) {
        i = x * c + (b >> 3);

        if (ld[i] === undefined) {
          ld[i] = 0;
        }

        l = y * density + b;
        if (l < this.size.height) {
          if (this.data[l * this.size.width + x]) {
            ld[i] += (0x80 >> (b & 0x7));
          }
        }
      }
    }
  }

  return {
    data: result,
    density: density
  };
};
/**
 * [toRaster description]
 * @return {[type]} [description]
 */
Image.prototype.toRaster = function () {
  var result = [];
  var width  = this.size.width;
  var height = this.size.height;
  var data   = this.data;

  // n blocks of lines
  var n = Math.ceil(width / 8);
  var x, y, b, c, i;

  for (y = 0; y < height; y++) {

    for (x = 0; x < n; x++) {

      for (b = 0; b < 8; b++) {
        i = x * 8 + b;

        if (result[y * n + x] === undefined) {
          result[y * n + x] = 0;
        }

        c = x * 8 + b;
        if (c < width) {
          if (data[y * width + i]) {
            result[y * n + x] += (0x80 >> (b & 0x7));
          }
        }
      }
    }
  }
  return {
    data: result,
    width: n,
    height: height
  };
}

Image.prototype.rotate = function () {
  const pixels = this.pixels.data;
  const width  = this.pixels.shape[0];
  const height = this.pixels.shape[1];
  const pixelComponentNumber = 4;
  const rotatedImage = new Array(width * height * pixelComponentNumber).fill(255);
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      const newX = y;
      const newY = x;
      const index = (y * width + x) * pixelComponentNumber;
      const newIndex = (newY * height + newX) * pixelComponentNumber;
      rotatedImage[newIndex] = pixels[index];
      rotatedImage[newIndex + 1] = pixels[index + 1];
      rotatedImage[newIndex + 2] = pixels[index + 2];
    }
  }
  this.pixels.data = rotatedImage;
  this.pixels.shape[0] = height;
  this.pixels.shape[1] = width;
  return this;
}

Image.prototype.removeTransparency = function () {
  const pixels = this.pixels.data;
  const width  = this.pixels.shape[0];
  const height = this.pixels.shape[1];
  const pixelComponentNumber = 4;
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      const index = (y * width + x) * pixelComponentNumber;
      const red = pixels[index];
      const blue = pixels[index + 1];
      const green = pixels[index + 2];
      const alpha = pixels[index + 3];
      if (red === 0 && green === 0 && blue === 0 && alpha < 127) {
        pixels[index] = 255;
        pixels[index + 1] = 255;
        pixels[index + 2] = 255;
        pixels[index + 3] = 255;
      }
    }
  }
  return this;
}

Image.prototype.toNV = function () {
  const data = [];
  const pixels = this.pixels.data;
  const width = this.pixels.shape[0];
  const height = this.pixels.shape[1];
  const pixelComponentNumber = 4;
  const ceilToNearestDividedBy8 = x => x % 8 === 0 ? x : x + 8 - (x % 8);
  const ceiledWidth = ceilToNearestDividedBy8(width);
  const ceiledHeight = ceilToNearestDividedBy8(height);
  let processedPixelCounter = 0;
  let valueByte = 0;
  for (let line = 0; line < height; ++line) {
    const start = line * width;
    for (let column = 0; column < width; ++column) {
      const index = (start + column) * pixelComponentNumber;
      if (pixels[index] === 0) {
        const position = column % 8;
        const value = (1 << (7 - position));
        valueByte = valueByte | value;
      }
      ++processedPixelCounter;
      if (processedPixelCounter === 8) {
        data.push(valueByte);
        processedPixelCounter = 0;
        valueByte = 0;
      }
    }
    if (processedPixelCounter !== 0) {
      data.push(valueByte);
      processedPixelCounter = 0;
      valueByte = 0;
    }
  }
  const byteDiff = (ceiledWidth * ceiledHeight / 8) - data.length;
  for (let counter = 0; counter < byteDiff; counter++) {
    data.push(0);
  }
  return {
    data,
    width: ceiledWidth / 8,
    height: ceiledHeight / 8,
  }
}

/**
 * [exports description]
 * @type {[type]}
 */
module.exports = Image;