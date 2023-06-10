# start by pulling the python image
FROM python:3.8-alpine

# Install manually all the missing libraries
# RUN apk update
# RUN apk install -y gconf-service libasound2 libatk1.0-0 libcairo2 libcups2 libfontconfig1 libgdk-pixbuf2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libxss1 fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils

# copy the requirements file into the image
COPY ./requirements.txt /app/requirements.txt

# Copy local code to the container image.
ENV APP_HOME /app
WORKDIR $APP_HOME

# install the dependencies and packages in the requirements file
RUN pip install -r requirements.txt

COPY . /app

CMD ["python", "-u", "src/view.py" ]