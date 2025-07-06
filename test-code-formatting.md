# Code Formatting Test

Test various code blocks to ensure proper formatting:

## Python Example (from screenshot)
```python
class Solution:
    def subsets(self, nums: List[int]) -> List[List[int]]:
        res = []
        
        def backtrack(start, path):
            res.append(path[:])
            for i in range(start, len(nums)):
                path.append(nums[i])
                backtrack(i + 1, path)
                path.pop()
        
        backtrack(0, [])
        return res
```

## JavaScript Example
```javascript
function calculateSum(numbers) {
    let sum = 0;
    for (let i = 0; i < numbers.length; i++) {
        sum += numbers[i];
    }
    return sum;
}
```

## Indented Code with Complex Structure
```python
def complex_function():
    if True:
        for i in range(10):
            if i % 2 == 0:
                print(f"Even: {i}")
            else:
                print(f"Odd: {i}")
                if i > 5:
                    print("    Greater than 5")
                    nested = {
                        "key": "value",
                        "nested": {
                            "deep": "structure"
                        }
                    }
```