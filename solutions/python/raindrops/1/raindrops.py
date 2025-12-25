def convert(number):
    potato = ""
    if(number % 3 == 0):
        potato += "Pling"
    if(number % 5 == 0):
        potato += "Plang"
    if(number % 7 == 0):
        potato += "Plong"
    if(len(potato) == 0):
        return str(number)
    return potato
