import re

# Function to read and parse benchmark data from a log file
def parse_benchmark_log(file_path):
    with open(file_path, 'r') as file:
        data = file.read()

    # Extracting size, elapsed, and rate values using regular expressions
    sizes = re.findall(r'size=(\d+)', data)
    elapsed = re.findall(r'elapsed: ([\d.]+)', data)
    rate = re.findall(r'rate: ([\d.]+)', data)

    # Converting extracted values to appropriate types
    sizes = list(map(int, sizes))
    elapsed = list(map(float, elapsed))
    rate = list(map(float, rate))

    return sizes, elapsed, rate

# Path to the log file
file_path = 'column-major1.txt'  # Replace with your log file path

# Parsing the log file
sizes, elapsed, rate = parse_benchmark_log(file_path)

# Displaying the extracted lists
print("Sizes:", sizes)
print("Elapsed:", elapsed)
print("Rate:", rate)

print(len(sizes))
print(len(elapsed))
print(len(rate))

file_path = 'column-major-1.txt'  # Replace with your log file path
sizes_column, elapsed_column, rate_column = parse_benchmark_log(file_path)

# do a line plot of rate

import matplotlib.pyplot as plt

plt.figure(figsize=(10, 6))
plt.plot(sizes, rate, marker='o', linestyle='-', color='red')
plt.plot(sizes_column, rate_column, marker='o', linestyle='dashed', color='green')
plt.xscale('log')
plt.yscale('log')
plt.xlabel('Size (log scale)')
plt.ylabel('Rate (log scale)')
plt.title('Rate vs. Size on a Log-Log Scale')
plt.grid(True, which="major", ls="--")
plt.legend(['row-major optimized', 'column-major optimized'])
plt.show()

