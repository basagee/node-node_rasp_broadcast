#!/bin/bash
SCRIPT_HOME="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
GIT_REPOS_ROOT="${SCRIPT_HOME}/../"

ARCH="$(uname -m)"

echo ${ARCH}
#mkdir -p ${GIT_REPOS_ROOT}

export CROSS="" #arm-linux-gnueabi-

NBP_MEDIA_APP_SRC_NAME="nbp_media_app"

# create or update git repos
if ((BASH_VERSINFO[0] >= 4)); then
    declare -A GIT_REPOS
    GIT_REPOS["${NBP_MEDIA_APP_SRC_NAME}"]="http://basagee@gitblit.basagee.tk/r/raspberry/nbp_media_app.git"
else
    GIT_REPOS=(
        '${NBP_MEDIA_APP_SRC_NAME}::://github.com/basagee/node-nbp_media_app.git'
    )
fi

function update_git_repositories() {
    if [ ! -d "$GIT_REPOS_ROOT/$1" ]; then
        echo "create new git repository....."

        cd $GIT_REPOS_ROOT
        # git clone and check success or not.
        git clone $2 $1
        if [ $? -eq 0 ]; then
            echo OK
        else
            echo FAIL
        fi
    else
        echo "git fetch check....."
        cd $GIT_REPOS_ROOT/$1

        # git: check if pull needed :
        git fetch origin
        reslog=$(git log HEAD..origin/master --oneline)
        if [[ "${reslog}" != "" ]] ; then
          git merge origin/master # completing the pull
        fi

    fi
}

if ((BASH_VERSINFO[0] >= 4)); then
    for repo in "${!GIT_REPOS[@]}"; do
        if ((BASH_VERSINFO[0] >= 4)); then
            KEY=$repo
            VALUE=${GIT_REPOS["$repo"]}
        else        ## for OSX and older bash version
            KEY="${repo%%::*}"
            VALUE="${repo##*::}"
        fi

        echo "## update_git_repositories() key = $KEY and value = $VALUE"
        update_git_repositories $KEY $VALUE

        cd $SCRIPT_HOME
    done
else
    for repo in "${GIT_REPOS[@]}"; do
        if ((BASH_VERSINFO[0] >= 4)); then
            KEY=$repo
            VALUE=${GIT_REPOS["$repo"]}
        else        ## for OSX and older bash version
            KEY="${repo%%::*}"
            VALUE="${repo##*::}"
        fi

        echo "## update_git_repositories() key = $KEY and value = $VALUE"
        update_git_repositories $KEY $VALUE

        cd $SCRIPT_HOME
    done
fi

# build_media_app
function build_media_app() {
    sudo apt-get install libv4l-dev libx264-dev libssl-dev asterisk libopus-dev
    sudo apt-get install alsa-base alsa-utils alsa-tools
    sudo apt-get install libasound2 libasound2-plugins libasound2-dev
    sudo apt-get install build-essential libfreeimage-dev libopenal-dev libpango1.0-dev libsndfile1-dev libudev-dev libjpeg-dev libtiff5-dev libwebp-dev automake

    sudo apt-get autoremove

    cd ${GIT_REPOS_ROOT}/${NBP_MEDIA_APP_SRC_NAME}/pjproject-2.6

    inputChar=""
    breakWhile=0

    while [ $breakWhile -eq 0 ];
    do
        # do inputChar read,
        echo ""
        echo ""
        echo "===== ${NBP_MEDIA_APP_SRC_NAME} ===================================="
        echo -n "Re-build ${NBP_MEDIA_APP_SRC_NAME} [Y/n] : "
        read inputChar
        # check it
        case "$inputChar" in
            \003)   # ctrl-C
                exit
                ;;
            "" | y | Y)
                breakWhile=1
                #install_curl=1
                echo "\n\n++++++ make clean ++++++"
                make clean
                echo "\n\n++++++ ./configure -disable-video -with-opus -disable-libwebrtc ++++++"
                ./configure -disable-video -with-opus -disable-libwebrtc
                echo "\n\n++++++ make dep ++++++"
                make dep
                ;;
            n)
                breakWhile=1
                ;;

        esac
    done

    echo "\n\n++++++ make ++++++"
    make
    #echo "\n\n++++++ make install ++++++"
    #sudo make install

    if [ ${ARCH} == "armv7l" ]; then
        cp -rf pjsip-apps/bin/pjsua-${ARCH}-unknown-linux-gnueabihf ${SCRIPT_HOME}
    else
        cp -rf pjsip-apps/bin/pjsua-${ARCH}-unknown-linux-gnu ${SCRIPT_HOME}
    fi
    cd $SCRIPT_HOME
}

function check_user_selection_default_y() {
    inputChar=""
    breakWhile=0

    while [ $breakWhile -eq 0 ];
    do
        # do inputChar read,
        echo ""
        echo ""
        echo "$1 ===================================="
        echo -n "(Re-)build $1 [Y/n] : "
        read inputChar
        # check it
        case "$inputChar" in
            \003)   # ctrl-C
                exit
                ;;
            "" | y | Y)
                breakWhile=1
                #install_curl=1
                $2
                ;;
            n)
                breakWhile=1
                ;;

        esac
    done
}

build_media_app
