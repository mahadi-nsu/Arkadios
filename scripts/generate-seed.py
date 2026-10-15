import json, datetime, random
from pathlib import Path
random.seed(14)
anchor=datetime.date(2026,10,15)
def dt(offset=0):return str(anchor+datetime.timedelta(days=offset))
def ts(offset=0):return dt(offset)+'T14:30:00.000Z'
def norm(rows):return {r['id']:r for r in rows}
stages=['prospect','onboarding','implementation','training','relationship']
labels=dict(zip(stages,['Prospect','Onboarding','Implementation','Training','Relationship']))
targets=dict(zip(stages,[14,21,30,14,90]))
depnames=['Relationship Ops.','Operations','Business Development','Technology','Training','Finance','Marketing','Executive']
deps=[dict(id=f'd{i+1}',name=n,managerId=f'u{[2,6,7,8,9,10,11,12][i]}') for i,n in enumerate(depnames)]
first=['Avery','Jordan','Olivia','Sam','Alex','Morgan','Taylor','Riley','Cameron','Jamie','Casey','Drew','Reese','Parker','Rowan','Quinn','Emerson','Blair','Hayden','Skyler','Finley','Sage','Ellis','Remy','Charlie']
last=['Morgan','Ellis','Chen','Rivera','Bennett','Parker','Hayes','Brooks','Reed','Collins','Foster','Wright','Sullivan','Price','Grant','Cole','Turner','West','Blake','Lewis','James','Cross','Wells','Hart','Miles']
users=[]
for i in range(50):
 n=first[i%25]+' '+last[(i+i//25*7)%25]; dep=f'd{i%8+1}'; role='Member'
 if i==0:role='Admin'
 if i==1:role='Manager';dep='d1'
 if i==2:dep='d3'
 if i==3:role='Read-only'
 if 5<=i<=11:role='Manager';dep=f'd{i-3}'
 users.append(dict(id=f'u{i+1}',name=n,email=n.lower().replace(' ','.')+f'{i+1}@example.com',departmentId=dep,role=role,active=True,invitation='Active'))
stepdefs={
'prospect':[('Confirm firm profile','Verified primary contact','d3',2),('Record discovery conversation','Note','d3',5),('Schedule partnership introduction','Meeting date','d3',10)],
'onboarding':[('Send partner agreement','Document/signature status','d2',3),('Confirm operating preferences','Note','d1',7),('Approve onboarding handoff','Note','d2',14)],
'implementation':[('Configure firm workspace','Note','d4',7),('Validate service setup','Note','d2',14),('Complete implementation review','Meeting date','d4',25)],
 'training':[('Schedule team orientation','Meeting date','d5',3),('Complete platform walkthrough','Note','d5',7),('Confirm training outcomes','Note','d5',12)],
'relationship':[('Record relationship plan','Note','d1',7),('Schedule first business review','Meeting date','d1',14)]}
workflows=[];versions=[]
for stage in stages:
 steps=[]
 for j,(title,evidence,dep,due) in enumerate(stepdefs[stage]):
  steps.append(dict(id=f'{stage}_s{j+1}',title=title,description=['Verify the primary business contact and required firm information.','Record a short summary and coordinate the responsible teams.','Confirm the date and capture handoff notes.'][j%3],required=True,departmentId=dep,assignment='Firm owner' if j==0 else 'Department queue',assigneeId='',dueDays=due,dependencies=[f'{stage}_s{j}'] if j else [],evidence=evidence))
 w=dict(id=f'w_{stage}',name=labels[stage]+' standard operating procedure',stage=stage,targetDays=targets[stage],steps=steps)
 workflows.append(w)
 versions.append(dict(**{**w,'id':f'v_{stage}_2'},version=2,publishedAt=ts(-35),publishedBy='u1'))
 if stage=='onboarding':versions.append(dict(**{**w,'id':'v_onboarding_1','targetDays':25},version=1,publishedAt=ts(-100),publishedBy='u1'))
firms=[];tasks=[];instances=[];projects=[];milestones=[];docs=[];history=[];activities=[];reviews=[];threads=[];messages=[]
entries=[('Northgate Wealth','onboarding'),('Vantage Point Capital','implementation'),('Harborline Advisors','prospect'),('Ironwood Trust','onboarding'),('Beacon Hill Partners','training'),('Larkspur Advisory','relationship'),('Solstice Financial','relationship')]
counts=dict(zip(stages,[14,6,5,4,38]))
for _,s in entries:counts[s]-=1
names=['Alder Grove','Cedarstone','Meridian','Evergreen','Summit Ridge','Crestview','Willow Creek','Atlas','Redwood','Stonebridge','Briarwood','Ashford','Seabrook','Juniper','Clearwater','Oakmont','Silverleaf','Westhaven','Bluewater','Kingsley','Highland','Pinecrest','Fairview','Riverbend','Maplewood','Sterling','Brookhaven','Windermere','Foxfield','Eastgate','Hawthorne','Elmstone','Rosewood','Ridgeline','Windsor','Springbrook','Kingsport','Millbrook','Sandstone','Brightwater','Copperfield','Greenfield','Parkside','Silverbrook','Crownpoint','Lakewood','Shoreline','Terrace','Bayshore','Cedar Hill','Valley Forge','Westfield','Belmont','Cypress','Canyon','Longview','Northfield','Southport','Glenwood','Waverly']
k=0
for stage,count in counts.items():
 for j in range(count):entries.append((names[k]+' '+['Partners','Advisory','Wealth','Capital'][k%4],stage));k+=1
for i,(name,stage) in enumerate(entries):
 fid=f'f{i+1}';age=[9,18,6,26,8,61,34][i] if i<7 else random.randint(1,targets[stage]+5)
 entered=dt(-age);dep={'prospect':'d3','onboarding':'d1','implementation':'d4','training':'d5','relationship':'d1'}[stage]
 owner=next(u['id'] for u in users if u['departmentId']==dep and u['role'] in ['Manager','Member'])
 f=dict(id=fid,name=name,type=['Wealth management','Independent advisory','Investment firm','Trust company'][i%4],location=['Atlanta, GA','Austin, TX','Charlotte, NC','Denver, CO','Boston, MA','Nashville, TN','Tampa, FL','Phoenix, AZ'][i%8],stage=stage,stageEntered=entered,ownerId=owner,departmentId=dep,archived=False,tags=[['Strategic partner','Southeast','Growth'][i%3]],nextAction=stepdefs[stage][0][0],lastActivity=ts(-(i%4)),custom={'cf_segment':['Enterprise','Growth','Core'][i%3]},notes=f'{name} is expanding its advisory team. Keep department handoffs visible and coordinate meeting dates with the primary contact.',relationshipHealth='Watch' if i%9==0 else 'Healthy',healthReason='Review follow-up cadence' if i%9==0 else 'Regular engagement and clear next steps.',renewalDate=dt(45+i*2))
 firms.append(f)
 ver=next(v for v in versions if v['id']==('v_onboarding_1' if i==3 else f'v_{stage}_2'))
 iid=f'inst_{fid}_{stage}';tids=[]
 for j,step in enumerate(ver['steps']):
  tid=f't_{fid}_{stage}_{j}';tids.append(tid)
  completed=(i==2 or (i not in [0,3] and (j==0 or (stage=='relationship' and i%4!=0))))
  status='Completed' if completed else ('In progress' if j==0 else 'Not started')
  task=dict(id=tid,title=step['title'],description=step['description'],firmId=fid,departmentId=step['departmentId'],assigneeId=owner if step['assignment']=='Firm owner' else '',priority='High' if i<5 else 'Medium',dueDate=dt(-age+step['dueDays']),status=status,dependencies=tids[-2:-1],evidence=step['evidence'],evidenceNote='Confirmed with the firm team during our introductory conversation.' if completed else '',meetingDate=dt(-2) if completed and step['evidence']=='Meeting date' else '',documentId=f'doc_{fid}' if stage=='onboarding' and j==0 else '',comments=[],instanceId=iid,stepId=step['id'],recurringDays=0)
  if completed:task['completedAt']=ts(-2)
  tasks.append(task)
 f['nextAction']=next((t['title'] for t in tasks if t['id'] in tids and t['status']!='Completed'),'Prepare for the next partner review' if stage=='relationship' else 'Review handoff for the next stage')
 instances.append(dict(id=iid,firmId=fid,stage=stage,versionId=ver['id'],snapshot=ver,entered=entered,taskIds=tids,handoffRequested=i==2))
 if stage in ['implementation','training']:
  pid=f'p_{fid}'; mids=[]
  for j,title in enumerate(['Kickoff & planning','Service validation','Partner launch']):
   mid=f'm_{fid}_{j}';mids.append(mid);milestones.append(dict(id=mid,projectId=pid,name=title,date=dt(-age+5+j*10),status='Completed' if j==0 else 'Upcoming'))
  projects.append(dict(id=pid,name=name+(' implementation' if stage=='implementation' else ' training program'),firmId=fid,ownerId=owner,type='Implementation' if stage=='implementation' else 'Training',startDate=entered,targetDate=dt(-age+ver['targetDays']),status='Active',taskIds=tids,milestoneIds=mids,notes='Coordinate delivery across teams and document each milestone.'))
  for t in tasks:
   if t['id'] in tids:t['projectId']=pid
 if stage=='onboarding' or i<7:
  docs.append(dict(id=f'doc_{fid}',name=name+' · Partner agreement',category='Agreements',firmId=fid,**({'taskId':tids[0]} if stage=='onboarding' else {}),version='1.0',added=dt(-age),status='Partially signed' if i==0 else ('Sent' if i==3 else 'Signed'),signers=[dict(name='Partner representative',email=f'partner{i+1}@example.com',**({'signedAt':ts(-2)} if i!=3 else {})),dict(name='Arkadios representative',email='agreements@example.com',**({'signedAt':ts(-1)} if i not in [0,3] else {}))],source='sample',fileName='partner-agreement.html',size=4200,events=[dict(at=ts(-age),label='Sample agreement added')]))
 if stage=='relationship':reviews.append(dict(id=f'r_{fid}',firmId=fid,ownerId=owner,type='Quarterly business review',date=dt(3+i%30),status='Scheduled',notes='Discuss service experience, team priorities, and upcoming milestones.'))
 elapsed=age
 for prev in reversed(stages[:stages.index(stage)]):
  duration=random.randint(max(3,targets[prev]-7),targets[prev]+10);ex=dt(-elapsed);en=dt(-elapsed-duration);elapsed+=duration
  history.append(dict(id=f'h_{fid}_{prev}',firmId=fid,stage=prev,entered=en,exited=ex,targetDays=targets[prev],approverId=owner))
 activities.append(dict(id=f'a_{fid}',firmId=fid,actorId=owner,at=ts(-(i%3)),label=f'Updated {labels[stage].lower()} plan and confirmed the next action.'))
 if i<18:
  th=f'th_{fid}';threads.append(dict(id=th,firmId=fid,contactIds=[f'c{i*10+1}'],subject=['Partnership kickoff & next steps','Agreement review and timeline','Getting ready for your team orientation','Quarterly planning conversation'][i%4],ownerId=owner,status='Open' if i%3 else 'Waiting',updatedAt=ts(-(i%4))))
  messages.extend([dict(id=f'msg_{fid}_1',threadId=th,author='Partner team',body=f'Thank you for the thoughtful introduction. Our team at {name} is ready to coordinate the next steps. Could you share the proposed timeline and key contacts?',at=ts(-3),kind='Incoming'),dict(id=f'msg_{fid}_2',threadId=th,author=next(u['name'] for u in users if u['id']==owner),body='I have shared the timeline with our operations team. We will confirm ownership and follow up with the next milestone.',at=ts(-1),kind='Demo reply')])
contacts=[]
cfirst=['Emma','Noah','Amelia','Liam','Sofia','Lucas','Isabella','Ethan','Mia','Oliver','Charlotte','Henry','Harper','Leo','Evelyn','James','Aria','Jack','Ella','Theo']
clast=['Anderson','Campbell','Mitchell','Ross','Henderson','Baker','Ward','Murphy','Cooper','Perry','Bailey','Russell','Griffin','Wood','Morris','Powell','Stewart','Watson','Kelly','Bell']
for i in range(700):
 fi=i//10 if i<670 else None;name=cfirst[i%20]+' '+clast[(i//20+i)%20]
 contacts.append(dict(id=f'c{i+1}',name=name,category='Vendor' if fi is None else ('Advisor' if i%10<5 else ('Firm staff' if i%10<8 else 'Support staff')),**({'firmId':f'f{fi+1}'} if fi is not None else {}),title=['Managing partner','Senior advisor','Operations director','Client service lead','Practice manager'][i%5],email=name.lower().replace(' ','.')+f'.{i+1}@example.com',phone=f'(404) 555-{1000+i:04d}',primary=i%10==0 and fi is not None,tags=['Primary' if i%10==0 else 'Partner team'],notes='Prefers scheduled check-ins and a written recap after meetings.',custom={},archived=False))
docs.extend([dict(id=f'library_{j}',name=name,category=cat,version='2.0',added=dt(-12),status='Draft',signers=[],source='sample',fileName=file,size=2400,events=[]) for j,(name,cat,file) in enumerate([('Getting started with Arkadios','Onboarding resources','getting-started.html'),('Partner training guide','Training materials','training-guide.html'),('Handoff meeting notes','Meeting notes','meeting-notes.html'),('Partner communication playbook','SOP templates','getting-started.html')])])
data=dict(schemaVersion=1,departments=norm(deps),users=norm(users),firms=norm(firms),contacts=norm(contacts),tasks=norm(tasks),projects=norm(projects),milestones=norm(milestones),documents=norm(docs),threads=norm(threads),messages=norm(messages),reviews=norm(reviews),workflows=norm(workflows),versions=norm(versions),instances=norm(instances),history=norm(history),activities=norm(activities),notifications=norm([dict(id='n_handoff_f3',recipientId='u1',title='Harborline is ready for handoff',body='All prospect requirements are complete. Review the evidence and approve onboarding.',href='/firms/detail?id=f3',read=False,at=ts())]),customFields=norm([dict(id='cf_segment',name='Partner segment',entity='firm',type='Select',required=False,options=['Enterprise','Growth','Core'])]),rules=norm([dict(id='rule_'+r,type=r,enabled=True,days=2 if r=='overdue' else 0) for r in ['overdue','stage-target','handoff','implementation-project']]),savedViews={},settings=dict(anchorDate=dt(),demoDate=dt(),personaId='u1',stageLabels=labels,defaultTargets=targets,integrations=[dict(name=n,lastSync=ts(-1),enabled=True) for n in ['Salesforce','Zendesk','E-signature provider']],reportSchedule=dict(enabled=False,frequency='Weekly',departmentId='')))
Path('src/data/seed.json').write_text(json.dumps(data,indent=2))
for fn,title,body in [('partner-agreement.html','Partner service agreement','This fictional sample describes partnership coordination, named points of contact, implementation planning, and recurring relationship reviews. Signature actions in Arkadios are local demonstrations only and have no legal effect.'),('getting-started.html','Your Arkadios partnership','Welcome to a connected home office. Your relationship owner coordinates onboarding, implementation, training, and ongoing reviews. Confirm your primary contact, review the partner agreement, and schedule a kickoff conversation.'),('training-guide.html','Partner training guide','Session 1: Team introduction and responsibilities. Session 2: Service coordination and communication. Session 3: Review cadence and next steps. Capture questions and confirm the training outcomes with your relationship owner.'),('meeting-notes.html','Handoff meeting notes','Agenda: Review completed requirements, confirm outstanding actions, introduce the next department, and agree on the target date. Decisions: The owner documents each action and schedules the next check-in.')]:
 Path('public/samples/'+fn).write_text(f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{title}</title><style>body{{font:16px/1.8 system-ui;color:#182230;max-width:700px;margin:70px auto;padding:30px}}small{{color:#0f766e;letter-spacing:3px}}h1{{font-size:32px}}footer{{margin-top:70px;border-top:1px solid #ddd;padding-top:20px;color:#667085}}</style></head><body><small>ARKADIOS · HOME OFFICE</small><h1>{title}</h1><p>Sample document · Version 1.0</p><hr><p>{body}</p><h2>Partner coordination</h2><p>Each team maintains a clear owner, a current next action, and a documented handoff. All example names and records are fictional.</p><footer>Demonstration material. No sensitive data. No binding signatures.</footer></body></html>')
print(f'Generated {len(firms)} firms, {len(users)} employees, {len(contacts)} contacts, {len(tasks)} tasks')
