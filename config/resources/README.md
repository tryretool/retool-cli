
## Resources
  
### How It Works

- Add a resource in your Retool instance and a .yml file will be generated in this folder
- Whenever someone spins up a new instance of Retool, the yml files will auto-generate the resources
- Make sure that your users have the same ENCRYPTION_KEY environment variable you used to create the resources, as this is necessary to decrypt DB passwords, etc.
