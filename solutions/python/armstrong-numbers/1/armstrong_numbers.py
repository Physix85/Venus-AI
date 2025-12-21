def is_armstrong_number(number):
    num_temp = str(number)
    count = 0
    for x in num_temp:
        count += int(x) ** len(num_temp)
    if(number == count):
        return True
    return False