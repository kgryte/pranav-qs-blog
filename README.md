# LAPACK in your web browser: high-performance linear algebra with stdlib

Web applications are rapidly emerging as a new frontier for high-performance scientific computation and AI-enabled end-user experiences. Underpinning the ML/AI revolution is linear algebra, a branch of mathematics concerning linear equations and their representations in vectors spaces and via matrices. [LAPACK](https://netlib.org/lapack/) ("**L**inear **A**lgebra **Pack**age") is a fundamental software library for numerical linear algebra, providing robust, battle-tested implementations of common matrix operations. Despite LAPACK being a foundational component of most numerical computing programming languages and libraries, a comprehensive, high-quality LAPACK implementation tailored to the unique constraints of the web has yet to materialize. That is...until now.

Hi! I am [Pranav Goswami](https://github.com/pranavchiku), and, over the past summer, I worked with [Athan Reines](https://github.com/kgryte) to add initial LAPACK support to [stdlib](https://github.com/stdlib-js/stdlib), a fundamental library for scientific computation written in C and JavaScript and optimized for use in web browsers and other web-native environments, such as Node.js and Deno. In this blog post, I'll discuss my journey, some expected and unexpected (!) challenges, and the road ahead. With a little bit of luck, my hope is that this work provides a critical building block in making web browsers a first-class environment for numerical computation and machine learning and portends a future of more powerful AI-enabled web applications.

Sound interesting? Let's go!

## What is stdlib?

Readers of this blog are likely Python enthusiasts and industry practitioners who are "in the know" regarding all things NumPy, SciPy, and PyTorch, but you may not be as intimately familiar with the wild world of web technologies. For those coming from the world of scientific Python, the easiest way to think of [stdlib](https://github.com/stdlib-js/stdlib) is as an open source scientific computing library in the mold of NumPy and SciPy providing multi-dimensional array data structures and associated routines for mathematics, statistics, and linear algebra, but which uses JavaScript, rather than Python, as its primary scripting language and is laser-focused on the web ecosystem and its application development paradigms. This focus necessitates some interesting design and project architecture decisions, which make stdlib rather unique when compared to more traditional libraries designed for numerical computation.

To take NumPy as an example, NumPy is a single monolithic library, where all of its components, outside of optional third-party dependencies such as OpenBLAS, form a single, indivisible unit. One cannot simply install NumPy routines for [array manipulation](https://numpy.org/doc/stable/reference/routines.array-manipulation.html) without installing all of NumPy. If you are deploying an application which only needs NumPy's `ndarray` object and a couple of manipulation routines, installing and bundling all of NumPy means including a considerable amount of ["dead code"](https://en.wikipedia.org/wiki/Dead_code). In web development parlance, we'd say that NumPy is not ["tree shakeable"](https://en.wikipedia.org/wiki/Tree_shaking). For a normal NumPy installation, this implies at least 30MB of disk space, and at least [15MB of disk space](https://towardsdatascience.com/how-to-shrink-numpy-scipy-pandas-and-matplotlib-for-your-data-product-4ec8d7e86ee4) for a customized build which excludes all debug statements. For SciPy, those numbers can balloon to 130MB and 50MB, respectively. Needless to say, shipping a 15MB library in a web application for just a few functions is a non-starter, especially for developers needing to deploy web applications to devices with poor network connectivity or memory constraints.

Given the unique constraints of web application development, stdlib takes a bottom-up approach to its design, where every unit of functionality can be installed and consumed independent of unrelated and unused parts of the codebase. By embracing a decomposable software architecture and [radical modularity](https://aredridel.dinhe.net/2016/06/04/radical-modularity/), stdlib offers users the ability to install and use exactly what they need, with little-to-no excess code beyond a desired set of APIs and their explicit dependencies, thus ensuring smaller memory footprints, bundle sizes, and faster deployment.

As an example, suppose you are working with two stacks of matrices (e.g., two-dimensional slices of three-dimensional cubes), and you want to select every other slice and perform the common BLAS operation `y += a*x`, where `x` and `y` are [`ndarrays`](https://stdlib.io/docs/api/latest/@stdlib/ndarray/ctor) and `a` is a scalar constant. To do this with NumPy, you'd first install all of NumPy

```bash
pip install numpy
```

and then perform the various operations

```python
# Import all of NumPy:
import numpy as np

# Define arrays:
x = np.asarray(...)
y = np.asarray(...)

# Perform operation:
y[::2,:,:] += 5.0 * x[::2,:,:]
```

With stdlib, in addition to installing as a monolithic library, you can install the various units of functionality as separate packages

```bash
npm install @stdlib/ndarray-fancy @stdlib/blas-daxpy
```

and then perform the various operations

```javascript
// Individually import desired functionality:
import FancyArray from '@stdlib/ndarray-fancy';
import daxpy from '@stdlib/blas-daxpy';

// Define ndarray meta data:
const shape = [4, 4, 4];
const strides = [...];
const offset = 0;

// Define arrays using a "lower-level" fancy array constructor:
const x = new FancyArray('float64', [...], shape, strides, offset, 'row-major');
const y = new FancyArray('float64', [...], shape, strides, offset, 'row-major');

// Perform operation:
daxpy(5.0, x['::2,:,:'], y['::2,:,:']);
```

Importantly, not only can you independently install any one of stdlib's over [4,000 packages](https://github.com/stdlib-js), but you can also fix, improve, and remix any one of those packages by forking an associated GitHub repository (e.g., see [`@stdlib/ndarray-fancy`](https://github.com/stdlib-js/ndarray-fancy/tree/main)). And by defining explicit layers of abstraction and dependency trees, stdlib offers you the freedom to choose the right layer of abstraction for your application. In some ways, it's a simple—and, if you're accustomed to conventional scientific software library design, perhaps unorthodox—idea, but, when tightly integrated with the web platform, it has powerful consequences and creates exciting new possibilities!

## What about WebAssembly?

Okay, so maybe your interest has piqued; stdlib seems intriguing. But what does this have to do with LAPACK in web browsers? Well, the goal of my summer project was to apply the stdlib ethos—small, narrowly scoped packages which do one thing and do one thing well—in bringing LAPACK to the web.

But wait, you say! That is an extreme undertaking. LAPACK is vast, with approximately 1,700 routines, and implementing even 10% of them within a three-month time frame is a significant challenge. Wouldn't it be better to just compile LAPACK to [WebAssembly](https://webassembly.org), a portable compilation target for programming languages such as C, Go, and Rust, which enables deployment on the web, and call it a day?

Unfortunately, there are several issues with this approach.

1. Compiling Fortran to WebAssembly is still an area of active development (see [1](https://gws.phd/posts/fortran_wasm/), [2](https://pyodide.org/en/0.25.0/project/roadmap.html#find-a-better-way-to-compile-fortran), [3](https://github.com/scipy/scipy/issues/15290), [4](https://github.com/pyodide/pyodide/issues/184), and [5](https://lfortran.org/blog/2023/05/lfortran-breakthrough-now-building-legacy-and-modern-minpack/)). At the time of this post, a common approach is to use [`f2c`](https://netlib.org/f2c/) to compile Fortran to C and then to perform a separate compilation step to convert C to WebAssembly. However, this approach is problematic as `f2c` only fully supports Fortran 77, and the generated code requires extensive patching. Work is underway to develop an LLVM-based Fortran compiler, but gaps and complex toolchains remain.
1. As alluded to above in the discussion concerning monolithic libraries in web applications, the vastness of LAPACK is part of the problem. Even if the compilation problem is solved, including a single WebAssembly binary containing all of LAPACK in a web application needing to use only one or two LAPACK routines means considerable dead code, resulting in slower loading times and increased memory consumption.
1. While powerful, WebAssembly entails a steeper learning curve and more complex set of toolchains. In end-user applications, interfacing between JavaScript—a web-native programming language—brings further increased complexity, especially when having to perform manual memory management.

To help illustrate the last point, let's return to the BLAS routine `daxpy`, which performs the operation `y = a*x + y` and where `x` and `y` are strided vectors and `a` a scalar constant. If implemented in C, a basic implementation might look like the following code snippet.

```c
void c_daxpy(const int N, const double alpha, const double *X, const int strideX, double *Y, const int strideY) {
	int ix;
	int iy;
	int i;
	if (N <= 0) {
		return;
	}
	if (alpha == 0.0) {
		return;
	}
	if (strideX < 0) {
		ix = (1-N) * strideX;
	} else {
		ix = 0;
	}
	if (strideY < 0) {
		iy = (1-N) * strideY;
	} else {
		iy = 0;
	}
	for (i = 0; i < N; i++) {
		Y[iy] += alpha * X[ix];
		ix += strideX;
		iy += strideY;
	}
	return;
}
````

After compilation to WebAssembly and loading the WebAssembly binary into our web application, we need perform a series of steps before we can call the `c_daxpy` routine from JavaScript. First, we need to instantiate a new WebAssembly module.

```javascript
const binary = new UintArray([...]);

const mod = new WebAssembly.Module(binary);
```

Next, we need to define module memory and create a new WebAssembly module instance.

```javascript
// Initialize 10 pages of memory and allow growth to 100 pages:
const mem = new WebAssembly.Memory({
	'initial': 10,  // 640KiB, where each page is 64KiB
	'maximum': 100  // 6.4MiB
});

// Create a new module instance:
const instance = new WebAssembly.Instance(mod, {
	'env': {
		'memory': mem
	}
});
```

After creating a module instance, we can now invoke the exported BLAS routine. However, if data is defined outside of module memory, we first need to copy that data to the memory instance and always do so in little-endian byte order.

```javascript
// External data:
const xdata = new Float64Array([...]);
const ydata = new Float64Array([...]);

// Specify a vector length:
const N = 5;

// Specify vector strides (in units of elements):
const strideX = 2;
const strideY = 4;

// Define pointers (i.e., byte offsets) for storing two vectors:
const xptr = 0;
const yptr = N * 8; // 8 bytes per double

// Create a DataView over module memory:
const view = new DataView(mem.buffer);

// Write data to the memory instance:
for (let i = 0; i < N; i++) {
	view.setFloat64(xptr+(i*8), xdata[i*strideX], true)
	view.setFloat64(yptr+(i*8), ydata[i*strideY], true)
}
```

Now that data is written to module memory, we can call the `c_daxpy` routine.

```javascript
instance.exports.c_daxpy(N, 5.0, xptr, 1, yptr, 1);
```

And, finally, if we need to pass the results to a downstream library without support for WebAssembly memory "pointers" (i.e., byte offsets), such as D3, for visualization or further analysis, we need to copy data from module memory back to the original output array.

```javascript
for (let i = 0; i < N; i++) {
	ydata[i*strideY] = view.getFloat64(yptr+(i*8), true);
}
```

That's a lot of work just to compute `y = a*x + y`. In contrast, compare to a vanilla JavaScript implementation, which might look like the following code snippet.

```javascript
function daxpy(N, alpha, X, strideX, Y, strideY) {
	let ix;
	let iy;
	let i;
	if (N <= 0) {
		return;
	}
	if (alpha == 0.0) {
		return;
	}
	if (strideX < 0) {
		ix = (1-N) * strideX;
	} else {
		ix = 0;
	}
	if (strideY < 0) {
		iy = (1-N) * strideY;
	} else {
		iy = 0;
	}
	for (i = 0; i < N; i++) {
		Y[iy] += alpha * X[ix];
		ix += strideX;
		iy += strideY;
	}
	return;
}
```

We can then directly call `daxpy` with our externally defined data without the data movement required in the WebAssembly example above.

```javascript
daxpy(N, xdata, strideX, ydata, strideY);
```

Not only is the WebAssembly approach less ergonomic (at least in this case!), but, as might be expected, there's a negative performance impact, as well.



TODO: Display performance graph. Dynamically linking wasm modules requires threading exports and imports. Standalone binaries can end up with duplicated code. Plain JavaScript can result in smaller bundle sizes, especially when factoring in necessary additional wasm glue code.



## Fortran and C implementation

A common question that arises is why Fortran and C implementations are necessary when the initial goal was to translate the project to JavaScript. This approach is part of a broader, multi-phase strategy. The JavaScript implementation serves as the foundation, allowing us to interface with Fortran and C, leveraging their performance advantages. We also support various accelerators based on the user’s operating system, such as Apple’s accelerator framework, and utilize multithreading capabilities.

Since Fortran is not universally supported across all environments, we maintain C implementations as well. This not only facilitates the creation of WebAssembly (Wasm) binaries, which can be used in browser environments, but also simplifies integration with individual packages. While Wasm support is not a primary goal, it remains a viable option.

Implementing the core functionality in JavaScript allows us to establish a comprehensive framework for documentation, testing, and benchmarking. With this solid groundwork, we can then systematically integrate the Fortran and C implementations. One challenge specific to Fortran was resolving build tooling issues that would allow dynamic dependency resolution, which delayed its integration.

In the interim, pure JavaScript fallbacks, supported by robust testing and benchmarking, enable rapid iterations and refinements of the API design and implementation logic, paving the way for future incorporation of Fortran and C components.

## Walkthrough

LAPACK is vast, with approximately 1,700 routines, and implementing even 10% of them within a three-month timeframe is a significant challenge. I found that selecting the right package was, and still is, one of the most difficult tasks I encountered during my internship. It felt akin to being given a collection of coins with values like 1000, 100, 10, 5, and so on, and being asked to select as many as possible to maximize the total value. That essentially summarized my problem.

One day, I reviewed all the available LAPACK routines from netlib-lapack, categorizing them based on difficulty and dependencies. I compiled this information into a list, which can be found at [lapack-tracker-issue](https://github.com/stdlib-js/stdlib/issues/2464). My original approach was to implement the routines in a depth-first manner for each package, which led to the creation of several dependency trees, prioritizing easier implementations.

I quickly realized that the depth-first approach would not be feasible, as we did not have the luxury of years to develop and integrate the packages. Instead, I had a strict timeline of just three months to get up to speed, minimize code errors, automate certain processes, and still maintain a steady and positive pace in implementing the packages.

After a discussion with Athan, we decided on a two-pronged strategy to avoid potential bottlenecks: (1) continue working in a depth-first approach to maintain progress while PRs are under review, and (2) focus on implementing packages that are leaf nodes in most dependency trees, thereby establishing a solid foundation for future development OR simply _pickup low hanging fruits_ :)

With the plan set, I opened my first LAPACK pull request (PR), which introduced a JavaScript implementation for dlaswp. The dlaswp routine performs a series of row interchanges on a matrix A using pivot indices stored in IPIV. This PR revealed several challenges that arose during the conversion of the original Fortran implementation to JavaScript. Let’s delve into these challenges:

## Challenges during Fortran to JS conversion

1. Supporting both `row-major` and `column-major`.

Fortran stores array elements in a `column-major` format, unlike C or JavaScript, which prefer `row-major` storage. Following the approach used in LAPACKE, we decided to introduce a new parameter, order, in each implementation to specify the storage layout. Based on the value of order, there would be distinct implementations and optimizations for each layout. The order we loop through multidimensional arrays can have a big impact on speed. Fortran is as said `column-major`, Meaning consecutive elements of a column are stored next to each other in memory, and we should loop through arrays in this order order of columns unlike conventional looping over rows.

<img src="/posts/implement-lapack-routines-in-stdlib/image-3.png" alt="Pictorial representation of how a matrix can be flattened based on row major and column major order" style={{position: 'relative', left: '15%', width: '70%', height: '50%'}} />

Let's illustrate this with an example. Consider a 2D array A of arbitrary size. We have implemented a function that copies the entire contents of matrix A into another matrix B. In `row-major` order iteration, we traverse the array by iterating over each row first, and within each row, we loop through the columns. On the other hand, in `column-major` order iteration, we loop through each column first, followed by the rows within that column. The code snippet below presents a cache-efficient implementation of the `dlacpy` function specifically optimized for `row-major` order traversal.

```javascript
function dlacpy( M, N, A, strideA1, strideA2, offsetA, B, strideB1, strideB2, offsetB ) {
  let S0 = N;
  let S1 = M;
  let da0 = strideA2;
  let da1 = strideA1 - S0 * strideA2;
  let db0 = strideB2;
  let db1 = strideB1 - S0 * strideB2;

  // Set the pointers to the first indexed elements in the respective matrices...
  let ia = offsetA;
  let ib = offsetB;

  // Iterate over the matrix dimensions...
  for (let i1 = 0; i1 < S1; i1++) {
    for (let i0 = 0; i0 < S0; i0++) {
      B[ib] = A[ia];
      ia += da0;
      ib += db0;
    }
    ia += da1;
    ib += db1;
  }
  return B;
}
```

Now, let's examine the plot below, which depicts the relationship between the rate of copying elements and the array size for both `row-major` and `column-major` orders. The plot shows that for smaller arrays, the copying rates for both orders are comparable. However, as the array size increases, the rate of copying for `row-major` order becomes significantly faster than that of `column-major` order. This performance boost is a result of the cache-optimization techniques employed in the implementation, which minimize the number of cache misses in `row-major` order, leading to enhanced efficiency for larger arrays.

> Rate vs Size plot: `row-major` vs `column-major` order

<img src="/posts/implement-lapack-routines-in-stdlib/group-1.png" alt="grouped column chart showing the impact of rate on varying size of matrix" style={{position: 'relative', left: '15%', width: '50%', height: '50%'}} />

Next step involves fixing the the iteration order first to `row-major` and then to `column-major` and compare how increasing the number of rows and columns affects the rate of copying elements from one matrix to another. Intuitively, one might expect that increasing the number of elements in a row would reduce the rate of copying, due to the limited cache size. Let's see if this intuition holds.

From the figure below, it is evident that increasing the row size has a more pronounced impact on the copying rate after a certain threshold. This is due to the limited cache size, resulting in a lower rate for larger row sizes when compared to increasing the column size. On the other hand, the column major plot shows no significant difference in the copying rate when increasing the row or column size in the `column-major` order. This is because `column-major` order experiences more frequent cache misses compared to `row-major` order, regardless of whether the size increase is in the rows or columns, leading to lower efficiency overall for both small and large sizes.

<img src="/posts/implement-lapack-routines-in-stdlib/group-2.png" alt="grouped column chart showing the impact of normalized rate on varying size of different types of matrices" style={{position: 'relative', left: '15%', width: '70%', height: '50%'}} />

Thereby, we need to ensure that our implementations are optimized for both `row-major` and `column-major` orders. We employ various optimization techniques, such as loop tiling and cache optimization, to enhance performance. While some of these optimizations are already present in Fortran codes, simplifying the translation process, in most cases, we need to identify and implement these optimizations ourselves to achieve optimal performance.

> `dlacpy` function with loop interchanged optimized for `column-major` order

With the following diff, we can interchange the loops to optimize the `dlacpy` function for `column-major` order.

```diff
@@ -233,12 +233,12 @@ function dlacpy( M, N, A, strideA1, strideA2, offsetA, B, strideB1, strideB2, of
        var i0;
        var i1;

-       S0 = N;
-       S1 = M;
-       da0 = strideA2;
-       da1 = strideA1 - ( S0*strideA2 );
-       db0 = strideB2;
-       db1 = strideB1 - ( S0*strideB2 );
+       S0 = M;
+       S1 = N;
+       da0 = strideA1;
+       da1 = strideA2 - ( S0*strideA1 );
+       db0 = strideB1;
+       db1 = strideB2 - ( S0*strideB1 );

        // Set the pointers to the first indexed elements in the respective matrices...
        ia = offsetA;
```

<img src="/posts/implement-lapack-routines-in-stdlib/group-3.png" alt="grouped column chart showing rates before and after performing column major optimization" style={{position: 'relative', left: '15%', width: '70%', height: '50%'}} />

It is evident that the optimized `dlacpy` function for `column-major` order is significantly faster ( almost 5x ) than the `row-major` order, as shown in the plot above. This optimization is crucial for enhancing performance, especially when dealing with large arrays.

2. Supporting `ndarray` APIs

For packages that accept arrays as arguments, we developed a foundational, private version from which two distinct APIs are derived: one for the standard API and another for the ndarray API, both of which are available to end users. The final design was achieved through multiple iterations. The initial design included an `order` parameter, an array argument `A`, and `LDA`, which stands for the leading dimension of the array. Traditional BLAS APIs assume a contiguous row and column order. The `ndarray` APIs make no assumptions, as shown in figure ndarray 1(A) below, allowing users the flexibility to define views over buffers in any desired manner. Consequently, we transitioned to a new design that accepts the order, the array argument `A`, `strideA1` (the stride of the first dimension of `A`), `strideA2` (the stride of the second dimension of `A`), and a final `offsetA` parameter, which serves as an index offset for `A`. In the final iteration, the `order` parameter was removed from the base implementation, as it can be easily inferred from the two stride values.

Let's now understand `ndarray` API using an example of LAPACK routine `dlacpy` that copies a matrix `A` to a matrix `B`. The function definition looks like:

```javascript
function dlacpy( M, N, A, offsetA, strideA1, strideA2, B, offsetB, strideB1, strideB2 );
```

<img src="/posts/implement-lapack-routines-in-stdlib/ndarray-example.png" alt="figure showing how stdlib ndarray apis are different from conventional blas apis and an example to copy element from matrix A to matrix B" style={{position: 'relative', left: '25%', width: '50%', height: '50%'}} />

Suppose you want to copy the matrix A to B using the ndarray API, as illustrated in the graphic above. This operation is not feasible with conventional LAPACK/BLAS APIs, but you can easily achieve it by running the dlacpy function with the following arguments:

```javascript
B = dlacpy(5, 4, A, 8, 2, 1, B, 10, 2, 5);
```

Not only just this, you may also support accessing elements in reverse order like:

```javascript
B = dlacpy(5, 4, A, 8, 2, 1, B, -10, -2, B.length - 6);
```

Additionally, you can also support accessing elements in reverse order, such as:

```javascript
/*
[ 999, 999, 999, 999, 999 ]
[  20, 999,  18, 999,  12 ]
[ 999, 999, 999, 999, 999 ]
[  10, 999,   4, 999,   2 ]
[ 999, 999, 999, 999, 999 ]
*/
```

3. Understanding legacy fortran code

Let’s illustrate this with an example. Consider a function `add` that takes two arguments: `N`, representing the size of the array, and an array `A`, which returns the sum of its elements. Please find the code snippet below.

```fortran
integer function add( M, N, A ) result(r)
    ! logic to compute sum of elements
end function

program main
    integer :: i, j, num, A( 4, 3 )
    integer :: res( 4 )
    do i = 1, 4
        do j = 1, 3
            ! num = compute elements to pass
            res( i ) = add( M, N, A( i, j ) )
        end do
    end do
end program
```

At first glance, it appears that the code is passing the `(i, j)th` element of `A` to `add`, making it seem incorrect. However, merely examining the code doesn't reveal whether `A(i, j:)`, `A(i:, j)`, `A(i:, j:)`, or a single array item is being referenced. In Fortran, `A(i, j)` represents a pointer to that location, allowing any of these combinations to be possible. This legacy behavior in Fortran is challenging to interpret and complicates translation to JavaScript. There’s an [active discussion](https://fortran-lang.discourse.group/t/matrix-index-pointer-confusion/8453) on Fortran-lang discourse addressing this issue. Similar legacy practices in Fortran further add to the complexity of converting code accurately to JavaScript.

More specifically, let us examine two additional implementations of the add function in Fortran, where the function computes the sum of elements across a row and a column.

- `add` function to compute sum of elements over a row

```fortran
integer function add( N, A ) result(r)
  integer, intent(in) :: N
  integer, dimension( N ), intent(in) :: A
  integer :: i
  r = 0
  do i = 1, N
      r = r + A( i )
  end do
end function
```

- `add` function to compute sum of elements over a column

```fortran
integer function add( M, A ) result(r)
  integer, intent(in) :: M
  integer, dimension( M ), intent(in) :: A
  integer :: i
  r = 0
  do i = 1, M
      r = r + A( i )
  end do
end function
```

If we attempt to convert these functions to JavaScript while assuming a column-major order, it is crucial to ensure that the logic is accurately translated to prevent any inconsistencies.

<img src="/posts/implement-lapack-routines-in-stdlib/challenge-fortran.png" alt="figure showing how to iterate across column and row of a given matrix" style={{position: 'relative', left: '25%', width: '50%', height: '50%'}} />

The definition of the add function will include two additional arguments: offsetA and strideA.

```javascript
function add( M, N, A, offsetA, strideA );
```

- JS translation of program considering `add` function to compute sum of elements over a row

```javascript
function main() {
  let i;
  let j;
  let num;
  let A;
  let res;
  A = new Float64Array(4 * 3);
  res = new Float64Array(4);
  for (i = 0; i < 4; i++) {
    for (j = 0; j < 3; j++) {
      // num = compute elements to pass
      res[i] = add(3, A, offsetA + i * 4, 3);
    }
  }
}
```

- JS translation of program considering `add` function to compute sum of elements over a column

```javascript
function main() {
  let i;
  let j;
  let num;
  let A;
  let res;
  A = new Float64Array(4 * 3);
  res = new Float64Array(4);
  for (i = 0; i < 4; i++) {
    for (j = 0; j < 3; j++) {
      // num = compute elements to pass
      res[i] = add(4, A, offsetA + i * 3, 1);
    }
  }
}
```

Thereby, understanding legacy Fortran code is crucial to accurately translating it to JavaScript, ensuring that the logic is correctly implemented to avoid discrepancies.

3. Optimization

At stdlib, we ensure that our implementations are optimized for both row-major and column-major orders. We employ various optimization techniques, such as loop tiling and cache optimization, to enhance performance. While some of these optimizations are already present in Fortran codes, simplifying the translation process, in most cases, we need to identify and implement these optimizations ourselves to achieve optimal performance.


<!--

FIXME: weave in within the conclusion

## How to call Fortran routines using JavaScript?

We leverage free-form Fortran code extensively to optimize the performance of various BLAS (Basic Linear Algebra Subprograms) and LAPACK (Linear Algebra Package) routines. In response, [Athan](https://www.linkedin.com/in/athanreines/) and I decided to document our methodology on [`How to Call Fortran Routines from JavaScript Using Node.js`](https://blog.stdlib.io/how-to-call-fortran-routines-from-javascript-with-node-js/).

-->

TODO: add status (link to tracker issue)


## Conclusion

While the internship has ended, my plan is to continue adding packages and pushing this effort along. Given the immense potential and LAPACK's fundamental importance, we'd love to see this initiative of bringing LAPACK to the web continue to grow, so, if you are interested in helping out and even sponsoring development, please don't hesitate to reach out!

And with that, I would like to thank Quansight and [Athan Reines](https://github.com/kgryte) for providing me with this opportunity. I feel incredibly fortunate to have learned so much. Being an intern at Quansight was long a dream of mine, and I am very grateful to have fulfilled it. I want to extend a special thanks to [Melissa Mendonça](https://github.com/melissawm), who is an amazing mentor and all around wonderful person; thank you for investing so much time in us!

Cheers!