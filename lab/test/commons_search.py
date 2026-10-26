import json, sys, urllib.request, urllib.parse
UA={'User-Agent':'RenLabBot/1.0 (educational project; contact via github Becky717)'}
def api(params):
    params.update(format='json')
    u='https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(params)
    return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=30))
for q in sys.argv[1:]:
    r=api(dict(action='query',generator='search',gsrsearch=q,gsrnamespace=6,gsrlimit=6,prop='imageinfo',iiprop='extmetadata|size',iiextmetadatafilter='LicenseShortName'))
    print('##',q)
    for p in sorted(r.get('query',{}).get('pages',{}).values(),key=lambda p:p.get('index',0)):
        ii=p['imageinfo'][0]; lic=ii.get('extmetadata',{}).get('LicenseShortName',{}).get('value')
        print('  ',p['title'],ii['width'],'x',ii['height'],'|',lic)
