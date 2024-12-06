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
1. While one could attempt to compile individual LAPACK routines to standalone WebAssembly binaries, doing so could result in binary bloat, as multiple standalone binaries may contain duplicated code from common dependencies. To mitigate binary bloat, one could attempt to perform module splitting. In this scenario, one first factors out common dependencies into a standalone binary containing shared code and then generates separate binaries for individual APIs. While suitable in some cases, this can quickly get unwieldy, as this approach requires linking individual WebAssembly modules at load-time by stitching together the exports of one or more modules with the imports of one or more other modules. Not only can this be tedious, but this approach also entails a performance penalty due to the fact that, when WebAssembly routines call imported exports, they now must cross over into JavaScript, rather than remaining within WebAssembly. Sound complex? It is!
1. Apart from WebAssembly modules operating exclusively on scalar input arguments (e.g., computing the sine of a single number), every WebAssembly module instance must be associated with WebAssembly memory, which is allocated in fixed increments of 64KiB (i.e., a "page"). And importantly, as of this blog post, WebAssembly memory can only grow and [never shrink](https://github.com/WebAssembly/memory-control/blob/16dd6b93ab82d0b4b252e3da5451e9b5e452ee62/proposals/memory-control/Overview.md). As there is currently no mechanism for releasing memory to a host, a WebAssembly application's memory footprint can only increase. These two aspects combined increase the likelihood of allocating memory which is never used and memory leaks.
1. Lastly, while powerful, WebAssembly entails a steeper learning curve and a more complex set of often rapidly evolving toolchains. In end-user applications, interfacing between JavaScript—a web-native dynamically-compiled programming language—and WebAssembly further brings increased complexity, especially when having to perform manual memory management.

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

With the JavaScript implementation, we can then directly call `daxpy` with our externally defined data without the data movement required in the WebAssembly example above.

```javascript
daxpy(N, xdata, strideX, ydata, strideY);
```

At least in this case, not only is the WebAssembly approach less ergonomic, but, as might be expected given the required data movement, there's a negative performance impact, as well, as demonstrated in the following figure.

<!-- TODO: remove the following Markdown image and keep the <figure> prior to publishing. The Markdown image is just for local development. -->

![Grouped column chart displaying a performance comparison of stdlib's C, JavaScript, and WebAssembly (Wasm) implementations for the BLAS routine daxpy for increasing array lengths.](./daxpy_wasm_comparison_benchmarks_small.png)

<figure style="text-align:center">
	<img src="/posts/implement-lapack-routines-in-stdlib/daxpy_wasm_comparison_benchmarks_small.png" alt="Grouped column chart displaying a performance comparison of stdlib's C, JavaScript, and WebAssembly (Wasm) implementations for the BLAS routine daxpy for increasing array lengths." style="position:relative,left:15%,width:70%,height:50%"/>
	<figcaption>
		Figure 1: Performance comparison of stdlib's C, JavaScript, and WebAssembly (Wasm) implementations for the BLAS routine <i>daxpy</i> for increasing array lengths (x-axis). In the Wasm (copy) benchmark, input and output data is copied to and from Wasm memory, leading to poorer performance.
	</figcaption>
</figure>

In the figure above, I'm displaying a performance comparison of stdlib's C, JavaScript, and WebAssembly (Wasm) implementations for the BLAS routine `daxpy` for increasing array lengths, as enumerated along the x-axis. The y-axis shows a normalized rate relative to a baseline C implementation. In the `Wasm` benchmark, input and output data is allocated and manipulated directly in WebAssembly module memory, and, in the `Wasm (copy)` benchmark, input and output data is copied to and from WebAssembly module memory, as discussed above. From the chart, we may observe the following:

1. In general, thanks to highly optimized just-in-time (JIT) compilers, JavaScript code, when carefully written, can execute only 2-to-3 times slower than native code. This result is impressive for a loosely typed, dynamically compiled programming language and, for `daxpy`, remains consistent across varying array lengths.
1. As data sizes and thus the amount of time spent in a WebAssembly module increase, WebAssembly can approach near-native (~1.5x) speed. This result aligns more generally with expected WebAssembly performance.
1. While WebAssembly can achieve near-native speed, data movement requirements may adversely affect performance, as observed for `daxpy`. In such cases, a well-crafted JavaScript implementation which avoids such requirements can achieve equal, if not better, performance, as is the case for `daxpy`. 

Overall, WebAssembly can offer performance improvements; however, the technology is not a silver bullet and needs to be used carefully in order to realize desired gains. And even when offering superior performance, such gains must be balanced against the costs of increased complexity, potentially larger bundle sizes, and more complex toolchains. For many applications, a plain JavaScript implementation will do just fine.

## Radical modularity

Now that I've prosecuted the case against just compiling the entirety of LAPACK to WebAssembly and calling it a day, where does that leave us? Well, if we're going to embrace the stdlib ethos, it leaves us in need of radical modularity.

To embrace radical modularity is to recognize that what is best is highly contextual, and, depending on the needs and constraints of user applications, developers need the flexibility to pick the right abstraction. If a developer is writing a Node.js application, that may mean binding to hardware-optimized libraries, such as OpenBLAS, Intel MKL, or Apple Accelerate in order to achieve superior performance. If a developer is deploying a web application needing a small set of numerical routines, JavaScript is likely the right tool for the job. And if a developer is working on a large, resource intensive WebAssembly application (e.g., for image editing or a gaming engine), then being able to easily compile individual routines as part of the larger application will be paramount. In short, we want a radically modular LAPACK.

My mission during the Quansight internship was to lay the groundwork for such an endeavor, to work out the kinks and find the gaps, and to hopefully get us a few steps closer to high-performance linear algebra on the web. But what does radically modularity look like? It all begins with the fundamental unit of functionality, the **package**.

Every package in stdlib is its own standalone thing, containing co-localized tests, benchmarks, examples, documentation, build files, and associated meta data (including the enumeration of any dependencies) and defining a clear API surface with the outside world. In order to add LAPACK support to stdlib, that means creating a separate standalone package for each LAPACK routine with the following structure:

```
├── benchmark
│   ├── c
│   │   ├── Makefile
│   │   └── benchmark.c
│   ├── fortran
│   │   ├── Makefile
│   │   └── benchmark.f
│   └── benchmark*.js
├── docs
│   ├── types
│   │   ├── index.d.ts
│   │   └── test.ts
│   └── repl.txt
├── examples
│   ├── c
│   │   ├── Makefile
│   │   └── example.c
│   └── index.js
├── include/*
├── lib
│   ├── index.js
│   └── *.js
├── src
│   ├── Makefile
│   ├── addon.c
│   ├── *.c
│   └── *.f
├── test
│   └── test*.js
├── binding.gyp
├── include.gypi
├── manifest.json
├── package.json
└── README.md
```

Briefly,

- **benchmark**: a folder containing micro-benchmarks to assess performance relative to a reference implementation (i.e., reference LAPACK).
- **docs**: a folder containing auxiliary documentation including REPL help text and TypeScript declarations defining typed API signatures.
- **examples**: a folder containing executable demonstration code, which, in addition to serving as documentation, helps developers sanity check implementation behavior.
- **include**: a folder containing C header files.
- **lib**: a folder containing JavaScript source implementations, with `index.js` serving as the package entry point and other `*.js` files defining internal implementation modules.
- **src**: a folder containing C and Fortran source implementations. Each modular LAPACK package should contain a slightly modified Fortran reference implementation (F77 to free-form Fortran). C files include a plain C implementation which follows the Fortran reference implementation, a wrapper for calling the Fortran reference implementation, a wrapper for calling hardware-optimized libraries (e.g., OpenBLAS) in server-side applications, and a native binding for calling into compiled C from JavaScript in Node.js or a compatible server-side JavaScript runtime.
- **test**: a folder containing unit tests for testing expected behavior in both JavaScript and native implementations. Tests for native implementations are written in JavaScript and leverage the native binding for interoperation between JavaScript and C/Fortran.
- **binding.gyp/include.gypi**: build files for compiling Node.js native add-ons, which provide a bridge between JavaScript and native code.
- **manifest.json**: configuration file for stdlib's internal C package management.
- **package.json**: package meta data, including the enumeration of external package dependencies and a path to a plain JavaScript implementation for use in browser-based web applications.
- **README.md**: primary documentation which includes API signatures and examples for both JavaScript and C interfaces.

Given stdlib's demanding documentation and testing requirements, adding support for each routine is a decent amount of work, but the end result is robust, high-quality, and, most importantly, modular code suitable for serving as the foundation for scientific computation on the modern web. But enough with the preliminaries! Let's get down to business!

## A multi-phase approach

Building on previous efforts which added BLAS support to stdlib, we decided to follow a similar multi-phase approach when adding LAPACK support in which we first prioritize JavaScript implementations and their associated testing and documentation and then, once tests and documentation are present, back fill C and Fortran implementations and any associated native bindings to hardware-optimized libraries. This approach allows us to put some early points on the board, so to speak, quickly getting APIs in front of users, establishing robust test procedures and benchmarks, and investigating potential avenues for tooling and automation, before diving into the weeds of build toolchains and performance optimizations. But where to even begin?

To determine which LAPACK routines to target first, I parsed LAPACK's Fortran source code to generate a call graph. This allowed me to infer the dependency tree for each LAPACK routine. With the graph in hand, I then performed a topological sort, thus helping me identify routines without dependencies and which will inevitably be building blocks for other routines. While a depth-first approach in which I picked a particular high-level routine and worked backward would enable me to land a specific feature, such an approach might cause me to get bogged down trying to implement routines of increasing complexity. By focusing on the "leaves" of the graph, I could prioritize commonly used routines (i.e., routines with high _indegrees_) and thus maximize my impact by unlocking the ability to deliver multiple higher-level routines either later in my internship or by other contributors.

With my plan in hand, I was excited to get to work. For my first routine, I chose [`dlaswp`](https://www.netlib.org/lapack/explore-html/d1/d7e/group__laswp_ga5d3ea3e3cb61e32750bf062a2446aa33.html#ga5d3ea3e3cb61e32750bf062a2446aa33), which performs a series of row interchanges on a general rectangular matrix according to a provided list of pivot indices and which is a key building block for LAPACK's LU decomposition routines. And that is when my challenges began...

## Challenges

### Legacy Fortran code

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

### Test Coverage

One of the problems with pursuing a bottom-up approach to adding LAPACK support is that explicit unit tests for lower-level utility routines is often non-existent in LAPACK. LAPACK's test suite largely employs a hierarchical testing philosophy in which testing higher-level routines is assumed to ensure that their dependent lower-level routines are functioning correctly as part of an overall workflow. While one can argue that focusing on integration testing over unit testing for lower-level routines is reasonable, as adding tests for every routine could potentially increase the maintenance burden and complexity of LAPACK's testing framework, it means that we couldn't readily rely on prior art for unit testing and would have to come up with comprehensive unit tests for each lower-level routine on our own.

### Documentation

Along a similar vein to test coverage, outside of LAPACK itself, finding real-world documented examples showcasing the use of lower-level routines was challenging. While LAPACK routines are consistently preceded by a documentation comment providing descriptions of input arguments and possible return values, without code examples, visualizing and grokking expected input and output values could be hard, especially when dealing with specialized matrices. And while neither the absence of unit tests nor documented examples is the end of the world, it meant that adding LAPACK support to stdlib would be more of a slog than I expected. Writing benchmarks, tests, examples, and documentation was simply going to require more time and effort, potentially limiting the number of routines I could implement.

### Multiple memory layout orders

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

### ndarrays

TODO: discuss BLIS.


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

### Optimization

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