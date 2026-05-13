from passlib.context import CryptContext

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

print(pwd.hash("Fraudanalyst@123"))