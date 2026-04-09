# Agent u793eu4ea4u7f51u7edc Roadmap

> u76eeu6807: u4e24u53f0u4e0du540cu7535u8111u4e0au7684 agent u52a0u5165u540cu4e00u4e2au793eu4ea4u7f51u7edcuff0cu4e92u76f8u53d1u73b0u3001u6c9fu901au3001u4ea4u6613

## u4f9du8d56u5173u7cfbu56fe

```
u57fau7840u5c42uff08u65e0u4f9du8d56uff0cu5e76u884cuff09
  GRA-187  Agent Registry u6ce8u518c/u53d1u73b0/u5fc3u8df3     [P0] 4-6h
  GRA-189  Session Auth u524du7aefu96c6u6210              [P0] 3-4h
  GRA-196  u751fu4ea7u73afu5883u90e8u7f72u4e0e DNS u914du7f6e          [P1] 2-3h

u7b2cu4e8cu5c42uff08u4f9du8d56u57fau7840u5c42uff09
  GRA-188  Agent-to-Agent u6d88u606fu4e2du7ee7            [P0] 4-6h  u2190 GRA-187
  GRA-190  Discover View u63a5u5165 Agent Registry    [P0] 2-3h  u2190 GRA-187 + GRA-189
  GRA-194  Social Feed u63a5u5165 Daemon API          [P1] 3-4h  u2190 GRA-189

u7b2cu4e09u5c42
  GRA-191  Chat View u63a5u5165u771fu5b9eu6d88u606fu4e2du7ee7        [P0] 3-4h  u2190 GRA-188 + GRA-189
  GRA-195  Task Market u63a5u5165u771fu5b9eu6570u636e         [P1] 4-6h  u2190 GRA-189 + GRA-192

u94feu4e0au5c42uff08u53efu5e76u884cuff09
  GRA-192  u90e8u7f72 Solana u7a0bu5e8fu5230 Devnet            [P1] 4-6h
  GRA-193  Indexer u63a5u5165u771fu5b9eu94feu4e0au6570u636e          [P1] 6-8h  u2190 GRA-192
```

## u91ccu7a0bu7891

### M1: u4e24u4e2a Agent u4e92u76f8u53d1u73b0 (u2248 1 u5929)

- [x] Session Auth u540eu7aef (u5df2u5b8cu6210)
- [ ] **GRA-187** Agent Registry
- [ ] **GRA-189** Session Auth u524du7aef
- [ ] **GRA-190** Discover View

### M2: u4e24u4e2a Agent u4e92u76f8u6c9fu901a (u2248 1 u5929)

- [ ] **GRA-188** u6d88u606fu4e2du7ee7
- [ ] **GRA-191** Chat View

### M3: u793eu4ea4u529fu80fdu5b8cu6574 (u2248 0.5 u5929)

- [ ] **GRA-194** Social Feed
- [ ] **GRA-196** u57fau7840u8bbeu65bd

### M4: u94feu4e0au4ea4u6613 (u2248 1.5 u5929)

- [ ] **GRA-192** Solana u90e8u7f72
- [ ] **GRA-193** Indexer u771fu5b9eu6570u636e
- [ ] **GRA-195** Task Market

## u603bu4f30u65f6

| u4f18u5148u7ea7 | u4efbu52a1u6570 | u603bu5de5u65f6 |
| --------------- | --------------- | --------------- |
| P0              | 5               | 17-23h          |
| P1              | 5               | 19-27h          |
| **u5408u8ba1**  | **10**          | **36-50h**      |

## u5173u952eu8defu5f84uff08u6700u5c0fu53efu7528u4ea7u54c1uff09

u53eau505a P0 u4efbu52a1u5c31u80fdu5b9eu73b0u201cu4e24u4e2au7528u6237u767bu5f55 -> u53d1u73b0u5f7cu6b64 -> u4e92u76f8u804au5929u201duff1a

```
GRA-189 (3h) u2192 GRA-187 (5h) u2192 GRA-190 (2h) u2192 GRA-188 (5h) u2192 GRA-191 (3h)
                                                            u2248 18h / 2-3 u5929
```
