import urllib.request
import json

def fetch():
    req = urllib.request.Request('http://localhost:8000/auth/login', 
        data=json.dumps({"email": "amit.sharma@school.com", "password": "admin"}).encode('utf-8'),
        headers={'Content-Type': 'application/json'})
    
    with urllib.request.urlopen(req) as response:
        login_data = json.loads(response.read())
        token = login_data['access_token']
        print('Got token')

    req2 = urllib.request.Request('http://localhost:8000/academic/my-teaching-profile',
        headers={'Authorization': f'Bearer {token}'})
    
    with urllib.request.urlopen(req2) as response:
        profile = json.loads(response.read())
        print('Profile:', profile)

fetch()
