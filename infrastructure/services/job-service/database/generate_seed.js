const fs = require('fs')
const path = require('path')

const TITLES = ['Software Engineer','Senior Software Engineer','Staff Engineer','Principal Engineer','Frontend Engineer','Backend Engineer','Full Stack Engineer','DevOps Engineer','Site Reliability Engineer','Data Engineer','ML Engineer','Android Engineer','iOS Engineer','Platform Engineer','Infrastructure Engineer','Security Engineer','QA Engineer','Engineering Manager','Product Manager','Data Scientist','Data Analyst','Business Analyst','UX Designer','UI Designer','Product Designer','Marketing Manager','Sales Engineer','Solutions Architect','Cloud Architect','Technical Lead']
const COMPANIES = ['Google','Meta','Apple','Amazon','Microsoft','Netflix','Uber','Lyft','Airbnb','Stripe','Twilio','Shopify','Salesforce','Oracle','IBM','Intel','Nvidia','AMD','Qualcomm','Cisco','VMware','Palo Alto Networks','CrowdStrike','Datadog','Snowflake','Databricks','Confluent','HashiCorp','Docker','GitHub','GitLab','Atlassian','Slack','Zoom','Dropbox','Box','Okta','Auth0','Cloudflare','Fastly','Akamai','Vercel','Netlify','Heroku','DigitalOcean','Linode','Rackspace','Dell','HP']
const LOCATIONS = ['San Francisco, CA','New York, NY','Seattle, WA','Austin, TX','Boston, MA','Chicago, IL','Los Angeles, CA','Denver, CO','Atlanta, GA','Miami, FL','Portland, OR','San Jose, CA','San Diego, CA','Dallas, TX','Houston, TX','Phoenix, AZ','Minneapolis, MN','Detroit, MI','Columbus, OH','Nashville, TN','Remote','Hybrid - San Francisco','Hybrid - New York','Hybrid - Seattle','Hybrid - Austin']
const EMPLOYMENT_TYPES = ['FULL_TIME','PART_TIME','CONTRACT','INTERNSHIP']
const SENIORITY = ['Internship','Entry','Associate','Mid-Senior','Director']
const REMOTE = ['onsite','remote','hybrid']
const INDUSTRIES = ['Technology','Finance','Healthcare','Education','Retail','Manufacturing','Consulting','Media','Transportation','Energy']
const SKILLS = [['JavaScript','React','Node.js','TypeScript'],['Python','Django','FastAPI','PostgreSQL'],['Java','Spring Boot','Kubernetes','Docker'],['Go','gRPC','Kubernetes','AWS'],['Rust','C++','Systems Programming'],['React','Vue','CSS','HTML','UX'],['Kafka','Spark','Hadoop','Scala'],['ML','TensorFlow','PyTorch','Python'],['AWS','GCP','Azure','Terraform','Ansible'],['Postgres','MySQL','Redis','MongoDB','Elasticsearch']]

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

const rows = []
const headers = 'job_id,title,company_id,location,employment_type,seniority_level,remote,description,skills_required,industry,views_count,applicants_count,status,posted_datetime,recruiter_id'
rows.push(headers)

for (let i = 0; i < 10000; i++) {
  const skills = pickN(SKILLS[rand(0, SKILLS.length - 1)], rand(2, 4))
  const desc = `We are looking for a talented ${pick(TITLES)} to join our growing team. You will work on challenging problems at scale.`
  const row = [
    uuid(),
    pick(TITLES),
    `company-${rand(1, 500).toString().padStart(4, '0')}`,
    pick(LOCATIONS),
    pick(EMPLOYMENT_TYPES),
    pick(SENIORITY),
    pick(REMOTE),
    desc.replace(/,/g, ';'),
    skills.join('|'),
    pick(INDUSTRIES),
    rand(0, 5000),
    rand(0, 300),
    Math.random() > 0.1 ? 'open' : 'closed',
    daysAgo(rand(0, 90)),
    `recruiter-${rand(1, 1000).toString().padStart(5, '0')}`
  ]
  rows.push(row.join(','))
}

const outPath = path.join(__dirname, '../data/sample_jobs.csv')
fs.writeFileSync(outPath, rows.join('\n'))
console.log(`Generated ${rows.length - 1} job rows → ${outPath}`)
