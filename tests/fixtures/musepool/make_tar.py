"""Write a tar.gz with hand-picked members: python3 -I make_tar.py <out.tar.gz> <members.json>

Each member is {"name", "type": "file"|"dir"|"symlink"|"hardlink", "data", "link"}; names are
written verbatim so tests can build archives no well-behaved packer would produce.
"""
import io
import json
import sys
import tarfile

TYPES = {"file": tarfile.REGTYPE, "dir": tarfile.DIRTYPE, "symlink": tarfile.SYMTYPE, "hardlink": tarfile.LNKTYPE}

with open(sys.argv[2], encoding="utf-8") as stream:
    members = json.load(stream)
with tarfile.open(sys.argv[1], "w:gz", format=tarfile.PAX_FORMAT) as archive:
    for member in members:
        info = tarfile.TarInfo(member["name"])
        info.type = TYPES[member.get("type", "file")]
        info.linkname = member.get("link", "")
        data = member.get("data", "").encode("utf-8") if info.type == tarfile.REGTYPE else b""
        info.size = len(data)
        archive.addfile(info, io.BytesIO(data))
