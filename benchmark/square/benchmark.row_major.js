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
	var sa;
	var sb;
	var A;
	var B;

	opts = {
		'dtype': 'float64'
	};

	A = uniform( numel( shape ), -10.0, 10.0, opts );
	B = uniform( numel( shape ), -10.0, 10.0, opts );

	sa = shape2strides( shape, order );
	sb = shape2strides( shape, order );

	return benchmark;

	/**
	* Benchmark function.
	*
	* @private
	* @param {Benchmark} b - benchmark instance
	*/
	function benchmark( b ) {
		var z;
		var i;

		b.tic();
		for ( i = 0; i < b.iterations; i++ ) {
			z = dlacpy( shape[0], shape[1], A, sa[0], sa[1], 0, B, sb[0], sb[1], 0 ); // eslint-disable-line max-len
			if ( isnan( z[ i%z.length ] ) ) {
				b.fail( 'should not return NaN' );
			}
		}
		b.toc();
		if ( isnan( z[ i%z.length ] ) ) {
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
			N = floor( pow( pow( 10, i ), 1.0/2.0 ) );
			sh = [ N, N ];
			f = createBenchmark( sh, orders[ j ] );
			bench( format( 'square::order=%s,shape=[%s],size=%d', orders[ j ], sh.join( ',' ), numel( sh ) ), f );
		}
	}
}

main();
