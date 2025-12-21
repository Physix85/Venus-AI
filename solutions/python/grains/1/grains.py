def square(number):
    if(number > 64 or number < 1):
        raise ValueError("square must be between 1 and 64")
    return 2 ** (number-1)
    pass


def total():
    count = 0
    for x in range(1,65):
        count += square(x)
    return count
