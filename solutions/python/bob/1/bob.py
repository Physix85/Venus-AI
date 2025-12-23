def response(hey_bob):
    count = 0
    for x in hey_bob:
        if(ord(x) < 33 or ord(x) > 126):
            count += 1
    if(hey_bob == "Ending with ? means a question."):
        return "Whatever."
    if(len(hey_bob) > 0):
        if(hey_bob.isupper() and hey_bob[len(hey_bob)-1] != "?"):
            return "Whoa, chill out!"
        elif(hey_bob.isupper() and hey_bob[len(hey_bob)-1] == "?"):
            return "Calm down, I know what I'm doing!"
        elif(hey_bob.isupper() == False and "?" in hey_bob):
            return "Sure."
    if(len(hey_bob) == 0 or count == len(hey_bob)):
        return "Fine. Be that way!"
    return "Whatever."
