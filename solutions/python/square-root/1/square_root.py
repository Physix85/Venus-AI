def square_root(number):
    target = 1
    while(target*target != number):
        if(target*target < number):
            target += 1
        elif(target*target > number):
            target -= 1
    return target
