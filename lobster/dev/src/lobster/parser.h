// Copyright 2014 Wouter van Oortmerssen. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

namespace lobster {

struct Parser {
    NativeRegistry &natreg;
    Lex lex;
    Node *root = nullptr;
    SymbolTable &st;
    vector<Function *> functionstack;
    struct ForwardFunctionCall {
        size_t maxscopelevel;
        string call_namespace;
        GenericCall *n;
        bool has_firstarg;
        SymbolTable::WithStackElem wse;
    };
    vector<ForwardFunctionCall> forwardfunctioncalls;
    bool call_noparens = false;
    set<string> pakfiles;
    struct BlockScope { Block *block; int for_nargs; };
    vector<BlockScope> block_stack;

    Parser(NativeRegistry &natreg, string_view _src, SymbolTable &_st, string_view _stringsource)
        : natreg(natreg), lex(_src, _st.filenames, _stringsource), st(_st) {}

    ~Parser() {
        delete root;
    }

    void Error(string_view err, const Node *what = nullptr) {
        lex.Error(err, what ? &what->line : nullptr);
    }

    void Warn(string_view warn, const Node *what = nullptr) {
        lex.Warn(warn, what ? &what->line : nullptr);
    }

    void Parse() {
        auto sf = st.FunctionScopeStart();
        st.toplevel = sf;
        auto &f = st.CreateFunction("__top_level_expression");
        f.overloads.push_back(nullptr);
        sf->SetParent(f, f.overloads[0]);
        f.anonymous = true;
        lex.Include("stdtype.lobster");
        sf->body = new Block(lex);
        ParseStatements(sf->body, T_ENDOFFILE);
        ImplicitReturn(sf);
        st.FunctionScopeCleanup();
        root = new Call(lex, sf);
        assert(forwardfunctioncalls.empty());
    }

    void ParseStatements(Block *block, TType terminator) {
        for (;;) {
            ParseTopExp(block);
            if (lex.token == T_ENDOFINCLUDE) {
                st.EndOfInclude();
                lex.PopIncludeContinue();
            } else if (!IsNext(T_LINEFEED)) {
                break;
            }
            if (Either(T_ENDOFFILE, T_DEDENT)) break;
        }
        Expect(terminator);
        auto b = block->children.back();
        if (Is<EnumRef>(b) || Is<UDTRef>(b) || Is<FunRef>(b) || Is<Define>(b)) {
            if (terminator == T_ENDOFFILE) block->Add(new IntConstant(lex, 0));
            else Error("last expression in list can\'t be a definition");
        }
        CleanupStatements(block);
    }

    void CleanupStatements(Block *list) {
        ResolveForwardFunctionCalls();
        for (auto def : list->children) {
            if (auto er = Is<EnumRef>(def)) {
                st.Unregister(er->e, st.enums);
            } else if (auto sr = Is<UDTRef>(def)) {
                if (sr->udt->predeclaration)
                    lex.Error("pre-declared struct never defined: " + sr->udt->name);
                st.Unregister(sr->udt, st.udts);
            } else if (auto fr = Is<FunRef>(def)) {
                auto f = fr->sf->parent;
                if (!f->anonymous) st.Unregister(f, st.functions);
            } else if (auto d = Is<Define>(def)) {
                for (auto p : d->sids) {
                    auto id = p.first->id;
                    id->static_constant =
                        id->single_assignment && d->child->IsConstInit();
                    if (id->single_assignment && !id->constant && d->line.fileidx == 0)
                        Warn("use \'let\' to declare: " + id->name, d);
                }
            } else if (auto r = Is<Return>(def)) {
                if (r != list->children.back())
                    Error("return must be last in block");
            }
        };
    }

    void ParseTopExp(Block *list, bool isprivate = false) {
        switch(lex.token) {
            case T_NAMESPACE:
                if (st.scopelevels.size() != 1 || isprivate)
                    Error("namespace must be used at file scope");
                lex.Next();
                st.current_namespace = lex.sattr;
                Expect(T_IDENT);
                break;
            case T_PRIVATE:
                if (st.scopelevels.size() != 1 || isprivate)
                    Error("private must be used at file scope");
                lex.Next();
                ParseTopExp(list, true);
                break;
            case T_INCLUDE: {
                if (isprivate)
                    Error("include cannot be private");
                lex.Next();
                if (IsNext(T_FROM)) {
                    auto fn = lex.StringVal();
                    Expect(T_STR);
                    AddDataDir(move(fn));
                } else {
                    string fn;
                    if (lex.token == T_STR) {
                        fn = lex.StringVal();
                        lex.Next();
                    } else {
                        fn = lex.sattr;
                        Expect(T_IDENT);
                        while (IsNext(T_DOT)) {
                            fn += "/";
                            fn += lex.sattr;
                            Expect(T_IDENT);
                        }
                        fn += ".lobster";
                    }
                    Expect(T_LINEFEED);
                    lex.Include(fn);
                    ParseTopExp(list);
                }
                break;
            }
            case T_STRUCT:
                ParseTypeDecl(true,  isprivate, list);
                break;
            case T_CLASS:
                ParseTypeDecl(false, isprivate, list);
                break;
            case T_FUN: {
                lex.Next();
                list->Add(ParseNamedFunctionDefinition(isprivate, nullptr));
                break;
            }
            case T_ENUM:
            case T_ENUM_FLAGS: {
                bool incremental = lex.token == T_ENUM;
                lex.Next();
                int64_t cur = incremental ? 0 : 1;
                auto enumname = st.MaybeNameSpace(ExpectId(), !isprivate);
                auto def = st.EnumLookup(enumname, lex, true);
                def->isprivate = isprivate;
                Expect(T_COLON);
                Expect(T_INDENT);
                for (;;) {
                    auto evname = st.MaybeNameSpace(ExpectId(), !isprivate);
                    if (IsNext(T_ASSIGN)) {
                        cur = lex.IntVal();
                        Expect(T_INT);
                    }
                    auto ev = st.EnumValLookup(evname, lex, true);
                    ev->isprivate = isprivate;
                    ev->val = cur;
                    ev->e = def;
                    def->vals.emplace_back(ev);
                    if (incremental) cur++; else cur *= 2;
                    if (!IsNext(T_LINEFEED) || Either(T_ENDOFFILE, T_DEDENT)) break;
                }
                Expect(T_DEDENT);
                list->Add(new EnumRef(lex, def));
                break;
            }
            case T_VAR:
            case T_CONST: {
                auto isconst = lex.token == T_CONST;
                lex.Next();
                auto def = new Define(lex, nullptr);
                for (;;) {
                    auto idname = ExpectId();
                    bool withtype = lex.token == T_TYPEIN;
                    UnresolvedTypeRef type = { nullptr };
                    if (lex.token == T_COLON || withtype) {
                        lex.Next();
                        type = ParseType(withtype);
                    }
                    auto id = st.LookupDef(idname, lex, true, withtype);
                    if (isconst)  id->constant = true;
                    if (isprivate) id->isprivate = true;
                    def->sids.push_back({ id->cursid, type });
                    if (!IsNext(T_COMMA)) break;
                }
                if (IsNext(T_LOGASSIGN)) {
                    for (auto p : def->sids) st.MakeLogVar(p.first->id);
                } else {
                    Expect(T_ASSIGN);
                }
                def->child = ParseMultiRet(ParseOpExp());
                list->Add(def);
                break;
            }
            default: {
                if (isprivate)
                    Error("private only applies to declarations");
                if (IsNextId()) {
                    // Regular assign is handled in normal expression parsing below.
                    if (lex.token == T_COMMA) {
                        auto al = new AssignList(lex, Modify(IdentUseOrWithStruct(lastid)));
                        while (IsNext(T_COMMA))
                            al->children.push_back(Modify(IdentUseOrWithStruct(ExpectId())));
                        Expect(T_ASSIGN);
                        al->children.push_back(ParseMultiRet(ParseOpExp()));
                        list->Add(al);
                        break;
                    } else {
                        lex.Undo(T_IDENT, lastid);
                    }
                }
                list->Add(ParseExpStat());
                break;
            }
        }
    }

    void ParseTypeDecl(bool is_struct, bool isprivate, Block *parent_list) {
        lex.Next();
        auto sname = st.MaybeNameSpace(ExpectId(), !isprivate);
        UDT *udt = &st.StructDecl(sname, lex, is_struct);
        auto parse_sup = [&] () {
            ExpectId();
            auto sup = &st.StructUse(lastid, lex);
            if (sup == udt) Error("can\'t inherit from: " + lastid);
            if (is_struct != sup->is_struct)
                Error("class/struct must match parent");
            return sup;
        };
        auto parse_specializers = [&] () {
            int i = 0;
            if (IsNext(T_LT)) {
                size_t j = 0;
                // Find first unbound generic.
                while (j < udt->generics.size() && !udt->generics[j].giventype.utr.Null()) j++;
                for (;;) {
                    if (j == udt->generics.size()) Error("too many type specializers");
                    udt->generics[j].giventype = ParseType(false);
                    if (IsNext(T_ASSIGN)) {
                        // FIXME: this is a bit of a hack now. We allow default values to be
                        // specified for specializers that apply to fields that have this type,
                        // but given that typevars can be a subtype of a fields type, this is
                        // now a bit odd.
                        auto def = ParseFactor();
                        for (auto &field : udt->fields) {
                            if (field.giventype.utr->t == V_TYPEVAR &&
                                field.giventype.utr->tv == udt->generics[j].tv) {
                                if (field.defaultval) Error("field already has a default value");
                                field.defaultval = def;
                            }
                        }
                    }
                    i++;
                    j++;
                    if (lex.token == T_GT) {
                        lex.OverrideCont(false);  // T_GT here should not continue the line.
                        lex.Next();
                        break;
                    }
                    Expect(T_COMMA);
                }
            }
            return i;
        };
        if (IsNext(T_ASSIGN)) {
            // A specialization of an existing struct
            auto sup = parse_sup();
            udt = sup->CloneInto(udt, sname, st.udttable);
            if (!parse_specializers())
                Error("no specialization types specified");
            if (isprivate != sup->isprivate)
                Error("specialization must have same privacy level");
            if (sup->predeclaration)
                Error("must specialization fully defined type");
            if (udt->generics.back().giventype.utr.Null())
                Error("missing specializers");
        } else if (Either(T_COLON, T_LT)) {
            // A regular struct declaration
            udt->isprivate = isprivate;
            if (IsNext(T_LT)) {
                for (;;) {
                    auto id = ExpectId();
                    for (auto &g : udt->generics)
                        if (g.tv->name == id)
                            Error("re-declaration of generic type");
                    udt->generics.push_back({ st.NewGeneric(id), { nullptr }, nullptr });
                    if (IsNext(T_GT)) break;
                    Expect(T_COMMA);
                }
            }
            Expect(T_COLON);
            if (lex.token == T_IDENT) {
                auto sup = parse_sup();
                if (sup->predeclaration) sup->predeclaration = false;  // Empty base class.
                udt->resolved_superclass = sup;
                udt->given_superclass = st.NewSpecUDT(sup);
                // FIXME: lift this restriction, only here because we overwrite generics, and
                // because of given_superclass.
                if (!udt->generics.empty())
                    Error("unimplemented: cannot add generics to generic base");
                udt->generics = sup->generics;
                for (auto &fld : sup->fields) {
                    udt->fields.push_back(fld);
                }
                parse_specializers();
                if (udt->FullyBound()) {
                    for (auto &g : udt->generics) {
                        udt->given_superclass->spec_udt->specializers.push_back(&*g.giventype.utr);
                    }
                    udt->given_superclass->spec_udt->is_generic = true;
                }
            }
            if (IsNext(T_INDENT)) {
                bool fieldsdone = false;
                st.bound_typevars_stack.push_back(&udt->generics);
                for (;;) {
                    if (IsNext(T_FUN)) {
                        fieldsdone = true;
                        parent_list->Add(ParseNamedFunctionDefinition(false, udt));
                    }
                    else {
                        if (fieldsdone) Error("fields must be declared before methods");
                        ExpectId();
                        auto &sfield = st.FieldDecl(lastid);
                        UnresolvedTypeRef type = { type_any };
                        if (IsNext(T_COLON)) {
                            type = ParseType(false);
                        }
                        Node *defaultval = IsNext(T_ASSIGN) ? ParseExp() : nullptr;
                        if (type.utr->t == V_ANY && !defaultval)
                            Error("must specify either type or default value");
                        udt->fields.push_back(Field(&sfield, type, defaultval));
                    }
                    if (!IsNext(T_LINEFEED) || Either(T_ENDOFFILE, T_DEDENT)) break;
                }
                Expect(T_DEDENT);
                st.bound_typevars_stack.pop_back();
            }
            if (udt->fields.empty() && udt->is_struct)
                Error("structs cannot be empty");
        } else {
            // A pre-declaration.
            udt->predeclaration = true;
        }
        udt->is_generic = false;
        udt->unspecialized.specializers.clear();
        for (auto &g : udt->generics) {
            auto type = g.giventype.utr.Null()
                ? UnresolvedTypeRef { &g.tv->thistype }
                : g.giventype;
            // This test works correctly if a generic refers to its own struct, since either
            // is_generic is still false, or it is already true if theres other generics.
            if (st.IsGeneric(type)) udt->is_generic = true;
            udt->unspecialized.specializers.push_back(&*type.utr);
            g.resolvedtype = type.utr;
        }
        udt->unspecialized.is_generic = udt->is_generic;
        parent_list->Add(new UDTRef(lex, udt));
    }

    Node *ParseNamedFunctionDefinition(bool isprivate, UDT *self) {
        // TODO: also exclude functions from namespacing whose first arg is a type namespaced to
        // current namespace (which is same as !self).
        auto idname = st.MaybeNameSpace(ExpectId(), !isprivate && !self);
        if (natreg.FindNative(idname))
            Error("cannot override built-in function: " + idname);
        return ParseFunction(&idname, isprivate, true, true, self);
    }

    void ImplicitReturn(SubFunction *sf) {
        // Anonymous functions and one-liners have an implicit return value.
        auto &stats = sf->body->children;
        if (!Is<Return>(stats.back())) {
            // Conversely, if named functions have no return at the end, we should
            // ensure any value accidentally available gets ignored and does not become a return
            // value.
            auto make_void = !sf->parent->anonymous;
            // All function bodies end in return, simplifying code downstream.
            stats.back() = new Return(stats.back()->line, stats.back(), sf, make_void);
        }
    }

    void GenImplicitGenericForLastArg() {
        auto sf = st.defsubfunctionstack.back();
        static const char *typevar_names = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        string_view nn;
        size_t gen_generics = 0;
        {
            again:
            if (gen_generics == 26) Error("too many implicit generics");
            nn = { typevar_names + gen_generics++, 1 };
            for (auto &btv : sf->generics) if (btv.tv->name == nn) goto again;
        }
        auto ng = st.NewGeneric(nn);
        sf->generics.push_back({ ng, { nullptr } });
        sf->args.back().type = &ng->thistype;
        sf->giventypes.push_back({ &ng->thistype });
    }

    void ParseBody(Block *block, int for_nargs) {
        block_stack.push_back({ block, for_nargs });
        if (IsNext(T_INDENT)) {
            return ParseStatements(block, T_DEDENT);
        } else {
            block->children.push_back(ParseExpStat());
            CleanupStatements(block);
        }
        block_stack.pop_back();
    }

    Node *ParseFunction(string_view *name, bool isprivate, bool parens, bool parseargs,
                        UDT *self = nullptr) {
        auto sf = st.FunctionScopeStart();
        st.bound_typevars_stack.push_back(&sf->generics);
        if (name) {
            // Parse generic params if any.
            // TODO: can this be extended to non-named functions syntactically?
            if (IsNext(T_LT)) {
                for (;;) {
                    auto ng = st.NewGeneric(ExpectId());
                    for (auto &btv : sf->generics) if (btv.tv->name == ng->name)
                        Error("re-definition of generic: " + ng->name);
                    sf->generics.push_back({ ng, { nullptr } });
                    if (IsNext(T_GT)) break;
                    Expect(T_COMMA);
                }
            }
        }
        if (parens) Expect(T_LEFTPAREN);
        size_t nargs = 0;
        if (self) {
            nargs++;
            auto id = st.LookupDef("this", lex, false, true);
            auto &arg = sf->args.back();
            arg.type = &self->unspecialized_type;
            sf->giventypes.push_back({ arg.type });
            st.AddWithStruct(arg.type, id, lex, sf);
            arg.withtype = true;
        }
        bool non_inline_method = false;
        if (lex.token != T_RIGHTPAREN && parseargs) {
            for (;;) {
                ExpectId();
                nargs++;
                bool withtype = lex.token == T_TYPEIN;
                auto id = st.LookupDef(lastid, lex, false, withtype);
                auto &arg = sf->args.back();
                if (parens && (lex.token == T_COLON || withtype)) {
                    lex.Next();
                    arg.type = ParseType(withtype, nullptr).utr;
                    if (withtype) st.AddWithStruct(arg.type, id, lex, sf);
                    if (nargs == 1 && arg.type->t == V_UUDT) {
                        non_inline_method = true;
                        self = arg.type->spec_udt->udt;
                        st.bound_typevars_stack.push_back(&self->generics);
                    }
                    sf->giventypes.push_back({ arg.type });
                } else {
                    GenImplicitGenericForLastArg();
                }
                if (!IsNext(T_COMMA)) break;
            }
        }
        if (parens) Expect(T_RIGHTPAREN);
        sf->method_of = self;
        auto &f = name ? st.FunctionDecl(*name, nargs, lex) : st.CreateFunction("");
        if (name && self) {
            for (auto isf : f.overloads) {
                if (isf->method_of == self) {
                    // FIXME: this currently disallows static overloads on the other args, that
                    // would be nice to add.
                    Error("method " + *name + " already declared for type: " + self->name);
                }
            }
        }
        f.overloads.push_back(nullptr);
        sf->SetParent(f, f.overloads.back());
        if (IsNext(T_CODOT)) {  // Return type decl.
            sf->returngiventype = ParseTypes(sf, LT_KEEP);
            sf->returntype = sf->returngiventype.utr;
        }
        if (!IsNext(T_COLON)) {
            // This must be a function type.
            if (lex.token == T_IDENT || !name) Expect(T_COLON);
            if (f.istype || f.overloads.size() > 1)
                Error("redefinition of function type: " + *name);
            f.istype = true;
            sf->typechecked = true;
            for (auto [i, arg] : enumerate(sf->args)) {
                if (st.IsGeneric(sf->giventypes[i]))
                    Error("function type arguments can't be generic");
                // No idea what the function is going to be, so have to default to borrow.
                arg.sid->lt = LT_BORROW;
            }
            if (sf->returngiventype.utr.Null())
                Error("missing return type or : in function definition header");
            if (!sf->generics.empty())
                Error("function type cannot have generics");
            sf->reqret = sf->returntype->NumValues();
        }
        if (name) {
            if (f.overloads.size() > 1) {
                // We could check here for "double declaration", but since that entails
                // detecting what is a legit overload or not, this is in general better left to the
                // type checker.
                if (!f.nargs()) Error("double declaration: " + f.name);
                for (auto [i, arg] : enumerate(sf->args)) {
                    if (!i && st.IsGeneric(sf->giventypes[i]))
                        Error("first argument of overloaded function must not be generic: " +
                              f.name);
                }
                if (isprivate != f.isprivate)
                    Error("inconsistent private annotation of multiple function implementations"
                          " for: " + *name);
            }
            f.isprivate = isprivate;
            functionstack.push_back(&f);
        } else {
            f.anonymous = true;
        }
        // Parse the body.
        if (!f.istype) {
            sf->body = new Block(lex);
            ParseBody(sf->body, -1);
            ImplicitReturn(sf);
        }
        if (name) functionstack.pop_back();
        if (non_inline_method) st.bound_typevars_stack.pop_back();
        st.bound_typevars_stack.pop_back();
        st.FunctionScopeCleanup();
        return new FunRef(lex, sf);
    }

    UnresolvedTypeRef ParseTypes(SubFunction *sfreturntype, Lifetime lt) {
        auto dest = ParseType(false, sfreturntype);
        if (!IsNext(T_COMMA)) return dest;
        vector<TypeRef> types;
        types.push_back(dest.utr);
        do {
            types.push_back(ParseType(false, sfreturntype).utr);
        } while (IsNext(T_COMMA));
        dest = { st.NewTuple(types.size()) };
        for (auto [i, type] : enumerate(types))
            dest.utr->Set(i, &*type, IsRefNil(type->t) ? lt : LT_ANY);
        return dest;
    }

    UnresolvedTypeRef ParseType(bool withtype, SubFunction *sfreturntype = nullptr) {
        TypeRef dest;
        switch(lex.token) {
            case T_INTTYPE:   dest = type_int;        lex.Next(); break;
            case T_FLOATTYPE: dest = type_float;      lex.Next(); break;
            case T_STRTYPE:   dest = type_string;     lex.Next(); break;
            case T_COROUTINE: dest = type_coroutine;  lex.Next(); break;
            case T_RESOURCE:  dest = type_resource;   lex.Next(); break;
            case T_IDENT: {
                auto f = st.FindFunction(lex.sattr);
                if (f && f->istype) {
                    dest = &f->overloads[0]->thistype;
                    lex.Next();
                    break;
                }
                auto e = st.EnumLookup(lex.sattr, lex, false);
                if (e) {
                    dest = &e->thistype;
                    lex.Next();
                    break;
                }
                for (auto gv : reverse(st.bound_typevars_stack)) {
                    for (auto &btv : *gv) {
                        if (btv.tv->name == lex.sattr) {
                            lex.Next();
                            dest = &btv.tv->thistype;
                            goto done;
                        }
                    }
                }
                dest = &st.StructUse(lex.sattr, lex).unspecialized_type;
                lex.Next();
                if (IsNext(T_LT)) {
                    dest = st.NewSpecUDT(dest->spec_udt->udt);
                    if (dest->spec_udt->udt->is_generic) dest->spec_udt->is_generic = true;
                    for (;;) {
                        auto s = ParseType(false);
                        if (st.IsGeneric(s)) dest->spec_udt->is_generic = true;
                        dest->spec_udt->specializers.push_back(&*s.utr);
                        if (lex.token == T_GT) {
                            // This may be the end of the line, so make sure Lex doesn't see it
                            // as a GT op.
                            lex.OverrideCont(false);
                            lex.Next();
                            break;
                        }
                        Expect(T_COMMA);
                    }
                } else {
                    if (dest->spec_udt->udt->is_generic)
                        Error("use of type " + dest->spec_udt->udt->name + " requires specializers");
                }
                done:
                break;
            }
            case T_LEFTBRACKET: {
                lex.Next();
                TypeRef elem = ParseType(false).utr;
                Expect(T_RIGHTBRACKET);
                dest = st.Wrap(elem, V_VECTOR);
                break;
            }
            case T_VOIDTYPE:
                if (sfreturntype) {
                    lex.Next();
                    dest = type_void;
                    sfreturntype->reqret = 0;
                    break;
                }
                // FALL-THRU:
            default:
                Error("illegal type syntax: " + lex.TokStr());
        }
        if (IsNext(T_QUESTIONMARK)) {
            if (!st.IsNillable(dest))
                Error("value types can\'t be made nilable");
            dest = st.Wrap(dest, V_NIL);
        }
        if (withtype && dest->t != V_UUDT)
            Error(":: must be used with a class type");
        return { dest };
    }

    void ParseFunArgs(List *list, Node *derefarg, bool noparens) {
        if (derefarg) {
            list->Add(derefarg);
            if (!IsNext(T_LEFTPAREN)) return;
        } else {
            if (!noparens) Expect(T_LEFTPAREN);
        }
        // Parse regular arguments.
        bool needscomma = false;
        for (;;) {
            if (!noparens && IsNext(T_RIGHTPAREN)) {
                if (call_noparens) {  // This call is an arg to a call that has no parens.
                    // Don't unnecessarily parse funvals. Means "if f(x):" parses as expected.
                    return;
                }
                break;
            }
            if (needscomma) Expect(T_COMMA);
            list->Add(ParseExp(noparens));
            if (noparens) {
                if (lex.token == T_COLON)
                    break;
                return;
            } else {
                needscomma = true;
            }
        }
        // Parse trailing function values.
        for (;;) {
            Node *e = nullptr;
            switch (lex.token) {
                case T_COLON:
                    e = ParseFunction(nullptr, false, false, false);
                    break;
                case T_IDENT:
                    e = ParseFunction(nullptr, false, false, true);
                    break;
                case T_LEFTPAREN:
                    e = ParseFunction(nullptr, false, true, true);
                    break;
                default:
                    return;
            }
            list->Add(e);
            auto islf = IsNext(T_LINEFEED);
            if (!islf && lex.token != T_LAMBDA) {
                return;
            }
            if (!IsNext(T_LAMBDA)) {
                lex.PushCur();
                if (islf) lex.Push(T_LINEFEED);
                lex.Next();
                return;
            }
        }
    }

    Node *ParseMultiRet(Node *first) {
        if (lex.token != T_COMMA) return first;
        auto list = new MultipleReturn(lex);
        list->Add(first);
        while (IsNext(T_COMMA)) {
            list->Add(ParseOpExp());
        }
        return list;
    }

    Node *ParseExpStat() {
        if (IsNext(T_RETURN)) {
            Node *rv = nullptr;
            if (!Either(T_LINEFEED, T_DEDENT, T_FROM)) {
                rv = ParseMultiRet(ParseOpExp());
            } else {
                rv = new DefaultVal(lex);
            }
            auto sf = st.toplevel;
            if (IsNext(T_FROM)) {
                if(!IsNext(T_PROGRAM)) {
                    if (!IsNextId())
                        Error("return from: must be followed by function identifier or"
                              " \"program\"");
                    auto f = st.FindFunction(lastid);
                    if (!f)
                        Error("return from: not a known function");
                    if (f->sibf || f->overloads.size() > 1)
                        Error("return from: function must have single implementation");
                    sf = f->overloads[0];
                }
            } else {
                if (functionstack.size())
                    sf = functionstack.back()->overloads.back();
            }
            return new Return(lex, rv, sf, false);
        }
        auto e = ParseExp();
        while (IsNext(T_SEMICOLON)) {
            if (IsNext(T_LINEFEED)) {
                // specialized error for all the C-style language users
                Error("\';\' is not a statement terminator");
            }
            e = new Seq(lex, e, ParseExp());
        }
        return e;
    }

    Node *Modify(Node *e) {
        if (auto idr = Is<IdentRef>(e))
            idr->sid->id->Assign(lex);
        return e;
    }

    void CheckOpEq(Node *e) {
        if (!Is<IdentRef>(e) && !Is<CoDot>(e) && !Is<Indexing>(e) && !Is<GenericCall>(e))
            Error("illegal left hand side of assignment");
        Modify(e);
        lex.Next();
    }

    Node *ParseExp(bool parent_noparens = false) {
        DS<bool> ds(call_noparens, parent_noparens);
        auto e = ParseOpExp();
        switch (lex.token) {
            case T_ASSIGN:  CheckOpEq(e); return new Assign(lex, e, ParseExp());
            case T_PLUSEQ:  CheckOpEq(e); return new PlusEq(lex, e, ParseExp());
            case T_MINUSEQ: CheckOpEq(e); return new MinusEq(lex, e, ParseExp());
            case T_MULTEQ:  CheckOpEq(e); return new MultiplyEq(lex, e, ParseExp());
            case T_DIVEQ:   CheckOpEq(e); return new DivideEq(lex, e, ParseExp());
            case T_MODEQ:   CheckOpEq(e); return new ModEq(lex, e, ParseExp());
            case T_ANDEQ:   CheckOpEq(e); return new AndEq(lex, e, ParseExp());
            case T_OREQ:    CheckOpEq(e); return new OrEq(lex, e, ParseExp());
            case T_XOREQ:   CheckOpEq(e); return new XorEq(lex, e, ParseExp());
            case T_ASLEQ:   CheckOpEq(e); return new ShiftLeftEq(lex, e, ParseExp());
            case T_ASREQ:   CheckOpEq(e); return new ShiftRightEq(lex, e, ParseExp());
            default:        return e;
        }
    }

    Node *ParseOpExp(uint level = 6) {
        static TType ops[][4] = {
            { T_MULT, T_DIV, T_MOD, T_NONE },
            { T_PLUS, T_MINUS, T_NONE, T_NONE },
            { T_ASL, T_ASR, T_NONE, T_NONE },
            { T_BITAND, T_BITOR, T_XOR, T_NONE },
            { T_LT, T_GT, T_LTEQ, T_GTEQ },
            { T_EQ, T_NEQ, T_NONE, T_NONE },
            { T_AND, T_OR, T_NONE, T_NONE },
        };
        Node *exp = level ? ParseOpExp(level - 1) : ParseUnary();
        TType *o = &ops[level][0];
        while (Either(o[0], o[1]) || Either(o[2], o[3])) {
            TType op = lex.token;
            lex.Next();
            auto rhs = level ? ParseOpExp(level - 1) : ParseUnary();
            switch (op) {
                case T_MULT:   exp = new Multiply(lex, exp, rhs); break;
                case T_DIV:    exp = new Divide(lex, exp, rhs); break;
                case T_MOD:    exp = new Mod(lex, exp, rhs); break;
                case T_PLUS:   exp = new Plus(lex, exp, rhs); break;
                case T_MINUS:  exp = new Minus(lex, exp, rhs); break;
                case T_ASL:    exp = new ShiftLeft(lex, exp, rhs); break;
                case T_ASR:    exp = new ShiftRight(lex, exp, rhs); break;
                case T_BITAND: exp = new BitAnd(lex, exp, rhs); break;
                case T_BITOR:  exp = new BitOr(lex, exp, rhs); break;
                case T_XOR:    exp = new Xor(lex, exp, rhs); break;
                case T_LT:     exp = new LessThan(lex, exp, rhs); break;
                case T_GT:     exp = new GreaterThan(lex, exp, rhs); break;
                case T_LTEQ:   exp = new LessThanEq(lex, exp, rhs); break;
                case T_GTEQ:   exp = new GreaterThanEq(lex, exp, rhs); break;
                case T_EQ:     exp = new Equal(lex, exp, rhs); break;
                case T_NEQ:    exp = new NotEqual(lex, exp, rhs); break;
                case T_AND:    exp = new And(lex, exp, rhs); break;
                case T_OR:     exp = new Or(lex, exp, rhs); break;
                default: assert(false);
            }
        }
        return exp;
    }

    Node *UnaryArg() {
        auto t = lex.token;
        lex.Next();
        auto e = ParseUnary();
        return t == T_INCR || t == T_DECR ? Modify(e) : e;
    }

    Node *ParseUnary() {
        switch (lex.token) {
            case T_MINUS: return new UnaryMinus(lex, UnaryArg());
            case T_NOT:   return new Not(lex, UnaryArg());
            case T_NEG:   return new Negate(lex, UnaryArg());
            case T_INCR:  return new PreIncr(lex, UnaryArg());
            case T_DECR:  return new PreDecr(lex, UnaryArg());
            default:      return ParseDeref();
        }
    }

    List *ParseFunctionCall(Function *f, NativeFun *nf, string_view idname, Node *firstarg,
                            bool noparens, size_t extra_args = 0,
                            vector<UnresolvedTypeRef> *specializers = nullptr) {
        auto wse = st.GetWithStackBack();
        // FIXME: move more of the code below into the type checker, and generalize the remaining
        // code to be as little dependent as possible on wether nf or f are available.
        // It should only parse args and construct a GenericCall.

        // We give precedence to builtins, unless we're calling a known function in a :: context.
        if (nf && (!f || !wse.id)) {
            auto nc = new GenericCall(lex, idname, nullptr, false, specializers);
            ParseFunArgs(nc, firstarg, noparens);
            for (auto [i, arg] : enumerate(nf->args)) {
                if (i >= nc->Arity()) {
                    auto &type = arg.type;
                    if (type->t == V_NIL) {
                        nc->Add(new DefaultVal(lex));
                    } else {
                        auto nargs = nc->Arity();
                        for (auto ol = nf->overloads; ol; ol = ol->overloads) {
                            // Typechecker will deal with it.
                            if (ol->args.size() == nargs) goto argsok;
                        }
                        Error("missing arg to builtin function: " + idname);
                    }
                }
            }
            argsok:
            return nc;
        }
        auto id = st.Lookup(idname);
        // If both a var and a function are in scope, the deepest scope wins.
        // Note: <, because functions are inside their own scope.
        if (f && (!id || id->scopelevel < f->scopelevel)) {
            if (f->istype) Error("can\'t call function type: " + f->name);
            auto call = new GenericCall(lex, idname, nullptr, false, specializers);
            if (!firstarg) firstarg = SelfArg(f, wse);
            ParseFunArgs(call, firstarg, noparens);
            auto nargs = call->Arity() + extra_args;  // FIXME!
            f = FindFunctionWithNargs(f, nargs, idname, nullptr);
            call->sf = f->overloads.back();
            return call;
        }
        if (id) {
            auto dc = new DynCall(lex, nullptr, id->cursid);
            ParseFunArgs(dc, firstarg, false);
            return dc;
        } else {
            auto call = new GenericCall(lex, idname, nullptr, false, specializers);
            ParseFunArgs(call, firstarg, false);
            ForwardFunctionCall ffc = {
                st.scopelevels.size(), st.current_namespace, call, !!firstarg, wse
            };
            forwardfunctioncalls.push_back(ffc);
            return call;
        }
    }

    IdentRef *SelfArg(const Function *f, const SymbolTable::WithStackElem &wse) {
        if (f->nargs()) {
            // If we're in the context of a withtype, calling a function that starts with an
            // arg of the same type we pass it in automatically.
            // This is maybe a bit very liberal, should maybe restrict it?
            for (auto sf : f->overloads) {
                auto &arg0 = sf->args[0];
                if (arg0.type->t == V_UUDT &&
                    wse.udt == arg0.type->spec_udt->udt &&
                    arg0.withtype) {
                    if (wse.id && wse.sf->parent != f) {  // Not in recursive calls.
                        return new IdentRef(lex, wse.id->cursid);
                    }
                    break;
                }
            }
        }
        return nullptr;
    }

    Function *FindFunctionWithNargs(Function *f, size_t nargs, string_view idname, Node *errnode) {
        for (; f; f = f->sibf)
            if (f->nargs() == nargs)
                return f;
        Error(cat("no version of function ", idname, " takes ", nargs, " arguments"), errnode);
        return nullptr;
    }

    void ResolveForwardFunctionCalls() {
        for (auto ffc = forwardfunctioncalls.begin(); ffc != forwardfunctioncalls.end(); ) {
            if (ffc->maxscopelevel >= st.scopelevels.size()) {
                swap(ffc->call_namespace, st.current_namespace);
                auto f = st.FindFunction(ffc->n->name);
                swap(ffc->call_namespace, st.current_namespace);
                if (f) {
                    if (!ffc->has_firstarg) {
                        auto self = SelfArg(f, ffc->wse);
                        if (self) ffc->n->children.insert(ffc->n->children.begin(), self);
                    }
                    ffc->n->sf = FindFunctionWithNargs(f,
                        ffc->n->Arity(), ffc->n->name, ffc->n)->overloads.back();
                    ffc = forwardfunctioncalls.erase(ffc);
                    continue;
                } else {
                    if (st.scopelevels.size() == 1)
                        Error("call to unknown function: " + ffc->n->name, ffc->n);
                    // Prevent it being found in sibling scopes.
                    ffc->maxscopelevel = st.scopelevels.size() - 1;
                }
            }
            ffc++;
        }
    }

    Node *ParseDeref() {
        auto n = ParseFactor();
        // FIXME: it would be good to narrow the kind of factors these derefs can attach to,
        // since for some of them it makes no sense (e.g. function call with lambda args).
        for (;;) switch (lex.token) {
            case T_DOT:
            case T_CODOT: {
                auto op = lex.token;
                lex.Next();
                auto idname = ExpectId();
                if (op == T_CODOT) {
                    // Here we just look up ANY var with this name, only in the typechecker can we
                    // know if it exists inside the coroutine. Can cause error if used before
                    // coroutine is defined, error hopefully hints at that.
                    auto id = st.LookupAny(idname);
                    if (!id)
                        Error("coroutines have no variable named: " + idname);
                    n = new CoDot(lex, n, new IdentRef(lex, id->cursid));
                } else {
                    auto fld = st.FieldUse(idname);
                    auto f = st.FindFunction(idname);
                    auto nf = natreg.FindNative(idname);
                    if (fld || f || nf) {
                        if (fld && lex.token != T_LEFTPAREN) {
                            auto dot = new GenericCall(lex, idname,
                                                       f ? f->overloads.back() : nullptr,
                                                       true, nullptr);
                            dot->Add(n);
                            n = dot;
                        } else {
                            auto specializers = ParseSpecializers(f && !nf);
                            n = ParseFunctionCall(f, nf, idname, n, false, 0, &specializers);
                        }
                    } else {
                        Error("unknown field/function: " + idname);
                    }
                }
                break;
            }
            case T_LEFTPAREN: {
                // Special purpose error to make this more understandable for the user.
                // FIXME: can remove this restriction if we make DynCall work with any node.
                Error("dynamic function value call must be on variable");
                return n;
            }
            case T_LEFTBRACKET: {
                lex.Next();
                n = new Indexing(lex, n, ParseExp());
                Expect(T_RIGHTBRACKET);
                break;
            }
            case T_INCR:
                n = new PostIncr(lex, Modify(n));
                lex.Next();
                return n;
            case T_DECR:
                n = new PostDecr(lex, Modify(n));
                lex.Next();
                return n;
            case T_IS: {
                lex.Next();
                auto is = new IsType(lex, n);
                is->giventype = ParseType(false);
                is->resolvedtype = is->giventype.utr;
                return is;
            }
            default:
                return n;
        }
    }

    Node *ParseFactor() {
        switch (lex.token) {
            case T_INT: {
                auto i = lex.IntVal();
                lex.Next();
                return new IntConstant(lex, i);
            }
            case T_FLOAT: {
                auto f = strtod(lex.sattr.data(), nullptr);
                lex.Next();
                return new FloatConstant(lex, f);
            }
            case T_STR: {
                string s = lex.StringVal();
                lex.Next();
                return new StringConstant(lex, s);
            }
            case T_NIL: {
                lex.Next();
                auto n = new Nil(lex, { nullptr });
                if (IsNext(T_TYPEIN)) {
                    n->giventype = ParseType(false);
                    n->giventype.utr = st.Wrap(n->giventype.utr, V_NIL);
                }
                return n;
            }
            case T_LEFTPAREN: {
                lex.Next();
                auto n = ParseExp();
                Expect(T_RIGHTPAREN);
                return n;
            }
            case T_LEFTBRACKET: {
                lex.Next();
                auto constructor = new Constructor(lex, { nullptr });
                ParseVector([this, &constructor] () {
                    constructor->Add(this->ParseExp());
                }, T_RIGHTBRACKET);
                if (IsNext(T_TYPEIN)) {
                    constructor->giventype = ParseType(false);
                    constructor->giventype.utr = st.Wrap(constructor->giventype.utr, V_VECTOR);
                }
                return constructor;
            }
            case T_LAMBDA: {
                lex.Next();
                return ParseFunction(nullptr, false, lex.token == T_LEFTPAREN,
                    lex.token != T_COLON);
            }
            case T_COROUTINE: {
                lex.Next();
                auto idname = ExpectId();
                auto specializers = ParseSpecializers(true);
                auto n = ParseFunctionCall(st.FindFunction(idname), nullptr, idname, nullptr,
                                           false, 1, &specializers);
                n->Add(new CoClosure(lex));
                return new CoRoutine(lex, n);
            }
            case T_FLOATTYPE:
            case T_INTTYPE:
            case T_STRTYPE:
            case T_ANYTYPE: {
                // These are also used as built-in functions, so allow them to function as
                // identifier for calls.
                auto idname = lex.sattr;
                lex.Next();
                if (lex.token != T_LEFTPAREN) Error("type used as expression");
                return IdentFactor(idname);
            }
            case T_TYPEOF: {  // "return", ident or type.
                lex.Next();
                if (lex.token == T_RETURN) {
                    lex.Next();
                    return new TypeOf(lex, new DefaultVal(lex));
                }
                if (lex.token == T_IDENT) {
                    auto id = st.Lookup(lex.sattr);
                    if (id) {
                        lex.Next();
                        return new TypeOf(lex, new IdentRef(lex, id->cursid));
                    }
                }
                auto tn = new TypeAnnotation(lex, ParseType(false));
                return new TypeOf(lex, tn);
            }
            case T_IDENT: {
                auto idname = lex.sattr;
                lex.Next();
                return IdentFactor(idname);
            }
            case T_PAKFILE: {
                lex.Next();
                string s = lex.StringVal();
                Expect(T_STR);
                pakfiles.insert(s);
                return new StringConstant(lex, s);
            }
            case T_IF: {
                lex.Next();
                return ParseIf();
            }
            case T_WHILE: {
                lex.Next();
                auto cond = ParseExp(true);
                return new While(lex, cond, ParseBlock());
            }
            case T_FOR: {
                lex.Next();
                Node *iter;
                if (IsNext(T_LEFTPAREN)) {
                    iter = ParseExp(false);
                    Expect(T_RIGHTPAREN);
                    return new For(lex, iter, ParseBlock(0, true));
                } else {
                    iter = ParseExp(true);
                    return new For(lex, iter, ParseBlock(0));
                }
            }
            case T_SWITCH: {
                lex.Next();
                auto value = ParseExp(true);
                Expect(T_COLON);
                Expect(T_INDENT);
                bool have_default = false;
                auto cases = new List(lex);
                for (;;) {
                    List *pattern = new List(lex);
                    if (lex.token == T_DEFAULT) {
                        if (have_default) Error("cannot have more than one default in a switch");
                        lex.Next();
                        have_default = true;
                    } else {
                        Expect(T_CASE);
                        for (;;) {
                            auto f = ParseDeref();
                            if (lex.token == T_DOTDOT) {
                                lex.Next();
                                f = new Range(lex, f, ParseDeref());
                            }
                            pattern->Add(f);
                            if (lex.token == T_COLON) break;
                            Expect(T_COMMA);
                        }
                    }
                    cases->Add(new Case(lex, pattern, ParseBlock()));
                    if (!IsNext(T_LINEFEED)) break;
                    if (lex.token == T_DEDENT) break;
                }
                Expect(T_DEDENT);
                return new Switch(lex, value, cases);
            }
            default:
                Error("illegal start of expression: " + lex.TokStr());
                return nullptr;
        }
    }

    Node *ParseIf() {
        auto cond = ParseExp(true);
        auto thenp = ParseBlock();
        auto islf = IsNext(T_LINEFEED);
        if (IsNext(T_ELIF)) {
            return new IfElse(lex, cond, thenp, (new Block(lex))->Add(ParseIf()));
        } else if (IsNext(T_ELSE)) {
            return new IfElse(lex, cond, thenp, ParseBlock());
        } else {
            lex.PushCur();
            if (islf) lex.Push(T_LINEFEED);
            lex.Next();
            return new IfThen(lex, cond, thenp);
        }
    }

    Block *ParseBlock(int for_args = -1, bool parse_args = false) {
        st.BlockScopeStart();
        auto block = new Block(lex);
        if (parse_args && lex.token != T_COLON) {
            auto parens = IsNext(T_LEFTPAREN);
            for (;;) {
                ExpectId();
                for_args++;
                bool withtype = lex.token == T_TYPEIN;
                auto id = st.LookupDef(lastid, lex, true, withtype);
                id->single_assignment = false;  // Mostly to stop warning that it is constant.
                UnresolvedTypeRef type = { nullptr };
                if (parens && (lex.token == T_COLON || withtype)) {
                    lex.Next();
                    type = ParseType(withtype, nullptr);
                    if (withtype) st.AddWithStruct(type.utr, id, lex, st.defsubfunctionstack.back());
                }
                Node *init = nullptr;
                if (for_args == 1) init = new ForLoopElem(lex);
                else if (for_args == 2) init = new ForLoopCounter(lex);
                else Error("for loop takes at most an element and index variable");
                auto def = new Define(lex, init);
                def->sids.push_back({ id->cursid, type });
                block->Add(def);
                if (!IsNext(T_COMMA)) break;
            }
            if (parens) Expect(T_RIGHTPAREN);
        }
        Expect(T_COLON);
        ParseBody(block, for_args);
        st.BlockScopeCleanup();
        return block;
    }

    void ParseVector(const function<void()> &f, TType closing) {
        if (IsNext(closing)) return;
        assert(lex.token != T_INDENT);  // Not generated inside brackets/braces.
        for (;;) {
            f();
            if (!IsNext(T_COMMA) || lex.token == closing) break;
        }
        Expect(closing);
    }

    vector<UnresolvedTypeRef> ParseSpecializers(bool likely_named_function) {
        vector<UnresolvedTypeRef> specializers;
        // Check for function call with generic params.
        // This is not a great way to distinguish from < operator exps, but best we can do?
        if (likely_named_function && lex.whitespacebefore == 0 && IsNext(T_LT)) {
            for (;;) {
                specializers.push_back(ParseType(false));
                if (IsNext(T_GT)) break;
                Expect(T_COMMA);
            }
        }
        return specializers;
    }

    Node *IdentFactor(string_view idname) {
        // First see if this a type constructor.
        auto udt = st.LookupStruct(idname);
        UnresolvedTypeRef type = { nullptr };
        if (udt && lex.token == T_LT) {
            lex.Undo(T_IDENT, idname);
            type = ParseType(false);
        } else if (lex.token == T_LEFTCURLY) {
            udt = &st.StructUse(idname, lex);
            type = { st.NewSpecUDT(udt) };
            type.utr->spec_udt->is_generic = udt->is_generic;
        } else {
            udt = nullptr;
        }
        if (udt) {
            Expect(T_LEFTCURLY);
            udt->constructed = true;
            vector<Node *> exps(udt->fields.size(), nullptr);
            ParseVector([&] () {
                auto id = lex.sattr;
                if (IsNext(T_IDENT)) {
                    if (IsNext(T_COLON)) {
                        auto fld = st.FieldUse(id);
                        auto field = udt->Has(fld);
                        if (field < 0) Error("unknown field: " + id);
                        if (exps[field]) Error("field initialized twice: " + id);
                        exps[field] = ParseExp();
                        return;
                    } else {
                        lex.Undo(T_IDENT, id);
                    }
                }
                // An initializer without a tag. Find first field without a default thats not
                // set yet.
                for (size_t i = 0; i < exps.size(); i++) {
                    if (!exps[i] && !udt->fields[i].defaultval) {
                        exps[i] = ParseExp();
                        return;
                    }
                }
                // Since this struct may be pre-declared, we allow to parse more initializers
                // than there are fields. We will catch this in the type checker.
                exps.push_back(ParseExp());
            }, T_RIGHTCURLY);
            // Now fill in defaults, check for missing fields, and construct list.
            auto constructor = new Constructor(lex, type);
            for (size_t i = 0; i < exps.size(); i++) {
                if (!exps[i]) {
                    if (udt->fields[i].defaultval)
                        exps[i] = udt->fields[i].defaultval->Clone();
                    else
                        Error("field not initialized: " + udt->fields[i].id->name);
                }
                constructor->Add(exps[i]);
            }
            return constructor;
        }
        // If we see "f(" the "(" is the start of an argument list, but for "f (", "(" is
        // part of an expression of a single argument with no extra "()".
        // This avoids things like "f (1 + 2) * 3" ("* 3" part of the single arg) being
        // interpreted as "f(1 + 2) * 3" (not part of the arg).
        // This is benign, since single arg calls with "()" work regardless of whitespace,
        // and multi-arg calls with whitespace will now error on the first "," (since we
        // don't have C's ","-operator).
        auto nf = natreg.FindNative(idname);
        auto f = st.FindFunction(idname);
        auto e = st.EnumLookup(idname, lex, false);
        if (lex.token == T_LEFTPAREN && lex.whitespacebefore == 0) {
            if (e && !f && !nf) {
                lex.Next();
                auto ec = new EnumCoercion(lex, ParseExp(), e);
                Expect(T_RIGHTPAREN);
                return ec;
            }
            return ParseFunctionCall(f, nf, idname, nullptr, false);
        }
        auto specializers = ParseSpecializers(f && !nf && !e);
        if (!specializers.empty())
            return ParseFunctionCall(f, nf, idname, nullptr, false, 0, &specializers);
        // Check for implicit variable.
        if (idname[0] == '_') {
            auto &bs = block_stack.back();
            auto id = st.Lookup(idname);
            auto sf = st.defsubfunctionstack.back();
            if (!id || id->cursid->sf_def != sf) {
                if (bs.for_nargs >= 0) {
                    id = st.LookupDef(idname, lex, true, false);
                    if (bs.for_nargs > 0) {
                        Error("cannot add implicit argument to for with existing arguments: " +
                              idname);
                    }
                    id->constant = true;
                    auto def = new Define(lex, new ForLoopElem(lex));
                    def->sids.push_back({ id->cursid, type });
                    bs.block->children.insert(bs.block->children.begin(), def);
                    bs.for_nargs++;
                } else {
                    id = st.LookupDef(idname, lex, false, false);
                    if (st.defsubfunctionstack.size() <= 1)
                        Error("cannot add implicit argument to top level: " + idname);
                    if (!sf->parent->anonymous)
                        Error("cannot use implicit argument: " + idname +
                            " in named function: " + sf->parent->name, sf->body);
                    if (sf->args[0].sid->id->name[0] != '_')
                        Error("cannot mix implicit argument: " + idname +
                            " with declared arguments in function", sf->body);
                    if (st.defsubfunctionstack.back()->args.back().type == type_any)
                        GenImplicitGenericForLastArg();
                }
            }
            return new IdentRef(lex, id->cursid);
        }
        auto id = st.Lookup(idname);
        // Check for function call without ().
        if (!id && (nf || f) && lex.whitespacebefore > 0 && lex.token != T_LINEFEED) {
            return ParseFunctionCall(f, nf, idname, nullptr, true);
        }
        // Check for enum value.
        auto ev = st.EnumValLookup(idname, lex, false);
        if (ev) {
            auto ic = new IntConstant(lex, ev->val);
            ic->from = ev;
            return ic;
        }
        return IdentUseOrWithStruct(idname, f || nf);
    }

    Node *IdentUseOrWithStruct(string_view idname, bool could_be_function = false) {
        // Check for field reference in function with :: arguments.
        Ident *id = nullptr;
        auto fld = st.LookupWithStruct(idname, lex, id);
        if (fld) {
            auto dot = new GenericCall(lex, idname, nullptr, true, nullptr);
            dot->Add(new IdentRef(lex, id->cursid));
            return dot;
        }
        // It's likely a regular variable.
        id = st.Lookup(idname);
        if (!id) {
            lex.Error((could_be_function
                ? "can't use named function as value: "
                : "unknown identifier: ") + idname);
        }
        return new IdentRef(lex, id->cursid);
    }

    bool IsNext(TType t) {
        bool isnext = lex.token == t;
        if (isnext) lex.Next();
        return isnext;
    }

    string_view lastid;

    bool IsNextId() {
        if (lex.token != T_IDENT) return false;
        lastid = lex.sattr;
        lex.Next();
        return true;
    }

    string_view ExpectId() {
        lastid = lex.sattr;
        Expect(T_IDENT);
        return lastid;
    }

    bool Either(TType t1, TType t2) {
        return lex.token == t1 || lex.token == t2;
    }
    bool Either(TType t1, TType t2, TType t3) {
        return lex.token == t1 || lex.token == t2 || lex.token == t3;
    }

    void Expect(TType t) {
        if (!IsNext(t))
            Error(lex.TokStr(t) + " expected, found: " + lex.TokStr());
    }

    string DumpAll(bool onlytypechecked = false) {
        string s;
        for (auto f : st.functiontable) {
            for (auto sf : f->overloads) {
                for (; sf; sf = sf->next) {
                    if (!onlytypechecked || sf->typechecked) {
                        s += "FUNCTION: " + f->name + "(";
                        for (auto &arg : sf->args) {
                            s += arg.sid->id->name + ":" + TypeName(arg.type) + " ";
                        }
                        s += ") -> ";
                        s += TypeName(sf->returntype);
                        s += "\n";
                        if (sf->body) s += DumpNode(*sf->body, 4, false);
                        s += "\n\n";
                    }
                }
            }
        }
        return s;
    }
};

}  // namespace lobster
