-- Úkoly od NPC: rozšíření na 16 úkolů Kalidry a 14 úkolů Legie (všechny oblasti mapy).
create or replace function public.ashes_wq_catalog()
 returns jsonb language sql immutable as $function$
  select $j${
    "k1":{"f":"kalidra","giver":"nikias","type":"talk","target":"nikias","count":1,"req":[],"xp":0.12,"gold":10},
    "k2":{"f":"kalidra","giver":"nikias","type":"kill","target":"vrakar","count":3,"req":["k1"],"xp":0.35,"gold":30},
    "k3":{"f":"kalidra","giver":"nikias","type":"talk","target":"damon","count":1,"req":["k1"],"xp":0.2,"gold":20},
    "k4":{"f":"kalidra","giver":"damon","type":"beacon","target":"beacon","count":3,"req":["k3"],"xp":0.45,"gold":45},
    "k5":{"f":"kalidra","giver":"damon","type":"kill","target":"zved-legie","count":4,"req":["k3"],"xp":0.5,"gold":50},
    "k6":{"f":"kalidra","giver":"tharos","type":"kill","target":"lapka","count":3,"req":["k1"],"xp":0.35,"gold":60},
    "k7":{"f":"kalidra","giver":"thalia","type":"visit","target":"memorial","count":1,"req":["k3"],"xp":0.3,"gold":25},
    "k8":{"f":"kalidra","giver":"eryon","type":"talk","target":"eryon","count":1,"req":["k4","k5"],"xp":0.6,"gold":80},
    "l1":{"f":"legie","giver":"varkas","type":"talk","target":"varkas","count":1,"req":[],"xp":0.12,"gold":10},
    "l2":{"f":"legie","giver":"varkas","type":"kill","target":"strazny-utesy","count":3,"req":["l1"],"xp":0.35,"gold":30},
    "l3":{"f":"legie","giver":"varkas","type":"talk","target":"oren","count":1,"req":["l1"],"xp":0.2,"gold":20},
    "l4":{"f":"legie","giver":"oren","type":"beacon","target":"beacon","count":3,"req":["l3"],"xp":0.45,"gold":45},
    "l5":{"f":"legie","giver":"oren","type":"kill","target":"zved-kalidra","count":4,"req":["l3"],"xp":0.5,"gold":50},
    "l6":{"f":"legie","giver":"azkar","type":"talk","target":"azkar","count":1,"req":["l4","l5"],"xp":0.6,"gold":80},
    "l7":{"f":"legie","giver":"rukmar","type":"kill","target":"strazce-akvaduktu","count":3,"req":["l1"],"xp":0.35,"gold":60},
    "k9":{"f":"kalidra","giver":"gorgias","type":"kill","target":"pasarak","count":3,"req":["k1"],"xp":0.35,"gold":40},
    "k10":{"f":"kalidra","giver":"melos","type":"talk","target":"pylas","count":1,"req":["k3"],"xp":0.2,"gold":20},
    "k11":{"f":"kalidra","giver":"pylas","type":"kill","target":"predvoj","count":4,"req":["k5"],"xp":0.5,"gold":55},
    "k12":{"f":"kalidra","giver":"thalia","type":"kill","target":"kultista","count":3,"req":["k7"],"xp":0.45,"gold":45},
    "k13":{"f":"kalidra","giver":"damon","type":"kill","target":"kopinik","count":4,"req":["k8"],"xp":0.55,"gold":70},
    "k14":{"f":"kalidra","giver":"eryon","type":"kill","target":"knez-slunce","count":3,"req":["k13"],"xp":0.6,"gold":80},
    "k15":{"f":"kalidra","giver":"damon","type":"kill","target":"strazce-lodi","count":3,"req":["k13"],"xp":0.6,"gold":80},
    "k16":{"f":"kalidra","giver":"eryon","type":"kill","target":"garda","count":3,"req":["k14","k15"],"xp":0.8,"gold":120},
    "l8":{"f":"legie","giver":"sabra","type":"kill","target":"rybar","count":3,"req":["l1"],"xp":0.35,"gold":40},
    "l9":{"f":"legie","giver":"taras","type":"talk","target":"rukmar","count":1,"req":["l3"],"xp":0.2,"gold":20},
    "l10":{"f":"legie","giver":"rukmar","type":"kill","target":"knezka","count":3,"req":["l7"],"xp":0.45,"gold":45},
    "l11":{"f":"legie","giver":"oren","type":"kill","target":"strazce-ohne","count":4,"req":["l5"],"xp":0.5,"gold":55},
    "l12":{"f":"legie","giver":"varkas","type":"kill","target":"obrance","count":4,"req":["l6"],"xp":0.55,"gold":70},
    "l13":{"f":"legie","giver":"azkar","type":"kill","target":"knez-kalidry","count":3,"req":["l12"],"xp":0.6,"gold":80},
    "l14":{"f":"legie","giver":"azkar","type":"kill","target":"straz-kalidry","count":3,"req":["l12","l13"],"xp":0.8,"gold":120}
  }$j$::jsonb;
$function$;
