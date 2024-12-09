#!/usr/bin/env node

/**
* @license Apache-2.0
*
* Copyright (c) 2024 The Stdlib Authors.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

'use strict';

// MODULES //

var bench = require( '@stdlib/bench' );
var uniform = require( '@stdlib/random/array/uniform' );
var isnan = require( '@stdlib/math/base/assert/is-nan' );
var pow = require( '@stdlib/math/base/special/pow' );
var floor = require( '@stdlib/math/base/special/floor' );
var shape2strides = require( '@stdlib/ndarray/base/shape2strides' );
var strides2offset = require( '@stdlib/ndarray/base/strides2offset' );
var numel = require( '@stdlib/ndarray/base/numel' );
var format = require( '@stdlib/string/format' );


// VARIABLES //

var orders = [
	'row-major'
];


// FUNCTIONS //

/**
* Copies all of a matrix `A` to another matrix `B`.
*
* @private
* @param {NonNegativeInteger} M - number of rows in matrix `A`
* @param {NonNegativeInteger} N - number of columns in matrix `A`
* @param {Float64Array} A - input matrix
* @param {integer} strideA1 - stride of the first dimension of `A`
* @param {integer} strideA2 - stride of the second dimension of `A`
* @param {NonNegativeInteger} offsetA - starting index for `A`
* @param {Float64Array} B - output matrix
* @param {integer} strideB1 - stride of the first dimension of `B`
* @param {integer} strideB2 - stride of the second dimension of `B`
* @param {NonNegativeInteger} offsetB - starting index for `B`
* @returns {Float64Array} `B`
*/
function dlacpy( M, N, A, strideA1, strideA2, offsetA, B, strideB1, strideB2, offsetB ) { // eslint-disable-line max-len
	var da0;
	var da1;
	var db0;
	var db1;
	var S0;
	var S1;
	var ia;
	var ib;
	var i0;
	var i1;

	S0 = M;
	S1 = N;
	da0 = strideA1;
	da1 = strideA2 - ( S0*strideA1 );
	db0 = strideB1;
	db1 = strideB2 - ( S0*strideB1 );

	// Set the pointers to the first indexed elements in the respective matrices...
	ia = offsetA;
	ib = offsetB;

	// Iterate over the matrix dimensions...
	for ( i1 = 0; i1 < S1; i1++ ) {
		for ( i0 = 0; i0 < S0; i0++ ) {
			B[ ib ] = A[ ia ];
			ia += da0;
			ib += db0;
		}
		ia += da1;
		ib += db1;
	}
	return B;
}

/**
* Creates a benchmark function.
*
* @private
* @param {PositiveIntegerArray} shape - matrix shape
* @param {string} order - matrix order
* @returns {Function} benchmark function
*/
function createBenchmark( shape, order ) {
	var opts;
	var sa1;
	var sb1;
	var sa;
	var sb;
	var oa;
	var ob;
	var A;
	var B;
	var N;

	opts = {
		'dtype': 'float64'
	};

	N = numel( shape );
	A = [
		uniform( N, -10.0, 10.0, opts ),
		uniform( N, -10.0, 10.0, opts ),
		uniform( N, -10.0, 10.0, opts )
	];
	B = uniform( N, -10.0, 10.0, opts );

	sa1 = shape2strides( shape, order );
	sb1 = shape2strides( shape, order );

	sa = [
		sa1,
		[ -sa1[0], -sa1[1] ]
	];
	sb = [
		sb1,
		[ -sb1[0], -sb1[1] ]
	];
	oa = [
		strides2offset( shape, sa[0] ),
		strides2offset( shape, sa[1] )
	];
	ob = [
		strides2offset( shape, sb[0] ),
		strides2offset( shape, sb[1] )
	];

	return benchmark;

	/**
	* Benchmark function.
	*
	* @private
	* @param {Benchmark} b - benchmark instance
	*/
	function benchmark( b ) {
		var sx;
		var sy;
		var ox;
		var oy;
		var x;
		var y;
		var z;
		var i;

		y = B;

		b.tic();
		for ( i = 0; i < b.iterations; i++ ) {
			x = A[ i%A.length ];
			sx = sa[ i%sa.length ];
			ox = oa[ i%oa.length ];
			sy = sb[ i%sb.length ];
			oy = ob[ i%ob.length ];
			z = dlacpy( shape[0], shape[1], x, sx[0], sx[1], ox, y, sy[0], sy[1], oy ); // eslint-disable-line max-len
			if ( isnan( z[ i%N ] ) ) {
				b.fail( 'should not return NaN' );
			}
		}
		b.toc();
		if ( isnan( z[ i%N ] ) ) {
			b.fail( 'should not return NaN' );
		}
		b.pass( 'benchmark finished' );
		b.end();
	}
}


// MAIN //

/**
* Main execution sequence.
*
* @private
*/
function main() {
	var min;
	var max;
	var sh;
	var N;
	var f;
	var i;
	var j;

	min = 2; // 10^min
	max = 8; // 10^max

	for ( j = 0; j < orders.length; j++ ) {
		for ( i = min; i <= max; i++ ) {
			N = floor( pow( 10, i ) / 5.0 );
			sh = [ 5, N ];
			f = createBenchmark( sh, orders[ j ] );
			bench( format( 'wide::order=%s,shape=[%s],size=%d', orders[ j ], sh.join( ',' ), numel( sh ) ), f );
		}
	}
}

main();
