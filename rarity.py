#!/usr/bin/python3
"""
Rarity Score:
    https://raritytools.medium.com/ranking-rarity-understanding-rarity-calculation-methods-86ceaeb9b98c
    https://metaversal.banklesshq.com/p/how-to-use-raritytools
"""
import json
from collections import defaultdict
from decimal import Decimal as D

tokens = json.loads(open('output/loot.json').read())

def traitCount():
    """
    Note:
    There are some clashes, eg namePrefix Big is substr of suffix "from Big
    Smoke" and "from the Big Easy". These are handled by anchoring to the
    quote leading the name prefix.

    NameSuffixes "Killer" and "Sin" are also handled by anchoring to the
    trailing quote.

    Some parts are substrings of other parts, these are handled using the
    `exclusions` lookup table.
    """
    itemParts = json.loads(open('output/item-parts.json').read())
    # rename item-parts keys to match loot.json key names
    itemParts['waist'] = itemParts.pop('waistArmor')
    itemParts['foot'] = itemParts.pop('footArmor')
    itemParts['hand'] = itemParts.pop('handArmor')
    itemParts['neck'] = itemParts.pop('necklaces')
    itemParts['ring'] = itemParts.pop('rings')
    itemParts['weapon'] = itemParts.pop('weapons')

    exclusions = {'Dress Shoes': 'Alligator Dress Shoes',
                  'Leather Gloves': 'Studded Leather Gloves',
                  'Knife': 'Pocket Knife',
                  'Scooter': 'Electric Scooter',
                  'Bike': 'Push Bike',
                  'The Orphan': 'The Orphan Maker'}
    r = {}
    for key in tokens[0]['1'].keys():
        kd, k, j = {}, {}, {}
        for part in itemParts[key]:
            c, p = 0, 0
            for item in tokens:
                i = next(iter(item.values()))
                if part in exclusions:
                    if (part in i[key]) and (exclusions[part] not in i[key]):
                        c += 1
                        if '+1' in i[key]:
                            p += 1
                else:
                    if part in i[key]:
                        c += 1
                        if '+1' in i[key]:
                            p += 1
            k[part] = c
            j[part] = p
        kd['parts'] = dict(sorted(k.items(), key=lambda x: x[1]))
        kd['parts-plus'] = dict(sorted(j.items(), key=lambda x: x[1]))

        for namePart, fmtStr in [('namePrefixes', '"%s '), ('nameSuffixes', '%s"'), ('suffixes', '%s')]:
            k = {}
            for part in itemParts[namePart]:
                c = 0
                for item in tokens:
                    i = next(iter(item.values()))
                    if part in exclusions:
                        if ((fmtStr % part) in i[key]) and (exclusions[part] not in i[key]):
                            c += 1
                    else:
                        if (fmtStr % part) in i[key]:
                            c += 1
                k[part] = c
            kd[namePart] = dict(sorted(k.items(), key=lambda x: x[1]))

        c = 0
        for item in tokens:
            i = next(iter(item.values()))
            if '+1' in i[key]:
                c += 1
        kd['plus'] = c

        r[key] = kd
    return r

def rarity(traitCounts, token):
    """
    Split each part into up to five traits and sum the rarity of each.
    """
    def score(i):
        return D('1') / (D(i) / D('8000'))

    m = {}
    for slot, part in token.items():
        prefixScore, nameSuffixScore, partScore, suffixScore, plusScore = D('0'), D('0'), D('0'), D('0'), D('0')
        hasPlus = False
        if '+1' in part:
            part = part.replace(' +1', '')
            plusScore = score(traitCounts[slot]['plus'])

        if 'from' in part:
            part, f = part.split(' from ')
            suffixScore = score(traitCounts[slot]['suffixes']['from %s' % f])

        if '"' in part:
            prefix, part = part.split('" ')
            name, nameSuffix = prefix.rsplit(' ', maxsplit=1)
            prefixScore = score(traitCounts[slot]['namePrefixes'][name.replace('"', '')])
            nameSuffixScore = score(traitCounts[slot]['nameSuffixes'][nameSuffix])

        partScore = score(traitCounts[slot]['parts'][part])
        
        # stable output at 4dp, i.e. * 10000
        m[slot] = int(sum([prefixScore, nameSuffixScore, partScore, suffixScore, plusScore]) * D('10000'))
    return m

def rarityPosition(traitCounts):
    r = defaultdict(set)
    for token in tokens:
        t = token[next(iter(token))]
        m = rarity(traitCounts, t)
        for slot, rare in m.items():
            r[slot].add(rare)
    return {x: sorted(y, reverse=True) for x, y in r.items()}

def rarityExport():
    rareM = {x['lootId']: x for x in json.loads(open('output/rare.json').read())}
    itemRarities = json.loads(open('output/item-rarities.json').read())
    occurences = json.loads(open('output/occurences.json').read())
    traitCounts = traitCount()
    rarityPositions = rarityPosition(traitCounts)
    r = []
    for token in tokens:
        i = next(iter(token))
        t = token[i]
        overall = rareM[int(i)]['rarest']
        items = {x: itemRarities[t[x]] for x in t.keys()}
        counts = {x: occurences[t[x]] for x in t.keys()}
        itemRarity = rarity(traitCounts, t)
        itemRarityPos = {x: rarityPositions[x].index(y) + 1 for x, y in itemRarity.items()}
        r.append({'token_id': i,
                  'rank': dict({'overall': overall, **items}),
                  'count': counts,
                  'rarity': itemRarity,
                  'rarityPosition': itemRarityPos})
    return r

if __name__ == '__main__':
    print(json.dumps(rarityExport(), indent=4))

